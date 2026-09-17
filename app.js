/* Design Hub V1 — lógica local de prototipo. La autenticación real y Supabase se conectarán en la siguiente fase. */
(() => {
  "use strict";

  const STORAGE = "design_hub_v1";
  const USERS = [
    {username:"admin", name:"Administrador", role:"admin"},
    {username:"mafe", name:"Mafe", role:"production_design"},
    {username:"finanzas", name:"Finanzas", role:"finance"}
  ];

  const seed = {
    currentUser:null,
    requests:[
      {id:crypto.randomUUID(),title:"Campaña lanzamiento Q4",client:"Cliente demo",assignee:"Mafe",due:"2026-09-20",status:"En curso",notes:"Pieza principal y adaptaciones."},
      {id:crypto.randomUUID(),title:"Ajuste brochure corporativo",client:"Cliente demo 2",assignee:"Camilo",due:"2026-09-18",status:"Ajustes",notes:"Pendiente validación del cliente."},
      {id:crypto.randomUUID(),title:"Kit redes sociales",client:"Cliente demo",assignee:"David",due:"2026-09-25",status:"En cola",notes:"Esperando brief."}
    ],
    clients:[
      {id:crypto.randomUUID(),name:"Cliente demo",contact:"Contacto comercial",email:"cliente@example.com",active:true},
      {id:crypto.randomUUID(),name:"Cliente demo 2",contact:"Contacto comercial",email:"cliente2@example.com",active:true}
    ],
    events:[]
  };

  let state = load();

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function load(){
    try {
      const raw = localStorage.getItem(STORAGE);
      if(!raw) return structuredClone(seed);
      const parsed = JSON.parse(raw);
      return {...structuredClone(seed), ...parsed};
    } catch { return structuredClone(seed); }
  }
  function persist(){ localStorage.setItem(STORAGE, JSON.stringify(state)); }

  function login(username){
    const user = USERS.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if(!user) return false;
    state.currentUser = user;
    persist();
    renderApp();
    return true;
  }

  function logout(){
    state.currentUser = null;
    persist();
    $("app").hidden = true;
    $("login-view").hidden = false;
  }

  function showView(view){
    document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== `${view}-view`);
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    if(view === "dashboard") renderDashboard();
    if(view === "requests") renderRequests();
    if(view === "clients") renderClients();
    if(view === "production") renderProduction();
    if(view === "finance") renderFinance();
    if(view === "history") renderHistory();
  }

  function statusClass(status){
    return status === "En curso" ? "progress" : status === "Ajustes" ? "adjust" : status === "Entregada" ? "done" : "queue";
  }

  function renderDashboard(){
    const r = state.requests;
    const counts = {
      "Activas": r.filter(x => x.status !== "Entregada").length,
      "En curso": r.filter(x => x.status === "En curso").length,
      "En cola": r.filter(x => x.status === "En cola").length,
      "Ajustes": r.filter(x => x.status === "Ajustes").length,
      "Vencidas": r.filter(x => x.status !== "Entregada" && x.due && x.due < new Date().toISOString().slice(0,10)).length,
      "Prioridad": r.filter(x => x.status === "Ajustes" || (x.due && x.due <= new Date().toISOString().slice(0,10))).length
    };
    $("kpi-grid").innerHTML = Object.entries(counts).map(([k,v]) => `<div class="kpi"><small>${esc(k)}</small><strong>${v}</strong></div>`).join("");
    $("priority-list").innerHTML = r.filter(x => x.status === "Ajustes" || x.due === new Date().toISOString().slice(0,10)).map(x =>
      `<div class="list-item"><span>${esc(x.title)}</span><span class="badge ${statusClass(x.status)}">${esc(x.status)}</span></div>`
    ).join("") || `<div class="muted">No hay prioridades registradas.</div>`;

    const by = {};
    r.forEach(x => { const key = x.assignee || "Sin asignar"; by[key] = (by[key] || 0) + 1; });
    $("workload-list").innerHTML = Object.entries(by).map(([name,n]) =>
      `<div class="list-item"><span>${esc(name)}</span><strong>${n}</strong></div>`).join("") || `<div class="muted">Sin solicitudes.</div>`;
  }

  function filteredRequests(){
    const q = $("request-search")?.value.trim().toLowerCase() || "";
    const s = $("request-status")?.value || "";
    return state.requests.filter(x => (!s || x.status === s) && (!q || [x.title,x.client,x.assignee].some(v => String(v||"").toLowerCase().includes(q))));
  }

  function renderRequests(){
    $("request-table-body").innerHTML = filteredRequests().map(x => `
      <tr>
        <td><strong>${esc(x.title)}</strong><br><small class="muted">${esc(x.notes || "")}</small></td>
        <td>${esc(x.client)}</td><td>${esc(x.assignee || "Sin asignar")}</td><td>${esc(x.due || "—")}</td>
        <td><span class="badge ${statusClass(x.status)}">${esc(x.status)}</span></td>
        <td><select data-status-id="${esc(x.id)}" aria-label="Estado de ${esc(x.title)}">
          ${["En cola","En curso","Ajustes","Entregada"].map(s => `<option ${s===x.status?"selected":""}>${s}</option>`).join("")}
        </select></td>
      </tr>`).join("") || `<tr><td colspan="6" class="muted">No hay solicitudes.</td></tr>`;
  }

  function renderClients(){
    $("clients-list").innerHTML = state.clients.map(c => `<article class="mini-card"><h3>${esc(c.name)}</h3><p>${esc(c.contact)}</p><p>${esc(c.email)}</p><span class="badge done">${c.active ? "Activo":"Inactivo"}</span></article>`).join("");
  }

  function renderProduction(){
    const people = ["Mafe","Camilo","David","Sin asignar"];
    $("production-cards").innerHTML = people.map(p => {
      const tasks = state.requests.filter(x => (x.assignee || "Sin asignar") === p);
      return `<article class="mini-card"><h3>${esc(p)}</h3><p>${tasks.length} solicitud(es)</p><p>${tasks.filter(x=>x.status==="En curso").length} en curso · ${tasks.filter(x=>x.status==="Ajustes").length} en ajustes</p></article>`;
    }).join("");
  }

  function renderFinance(){
    const total = state.requests.length;
    $("finance-kpis").innerHTML = [["Clientes",state.clients.length],["Solicitudes",total],["Entregadas",state.requests.filter(x=>x.status==="Entregada").length],["Facturación","Pendiente"]]
      .map(([k,v])=>`<div class="kpi"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join("");
  }

  function renderHistory(){
    $("history-list").innerHTML = state.events.slice().reverse().map(e => `<div class="list-item"><strong>${esc(e.action)}</strong><div class="muted">${esc(e.detail)}</div><time>${esc(e.at)} · ${esc(e.by)}</time></div>`).join("") || `<div class="muted">Aún no hay eventos.</div>`;
  }

  function addRequest(){
    $("request-dialog").showModal();
    $("request-title").focus();
  }

  function saveRequest(e){
    e.preventDefault();
    const title = $("request-title").value.trim(), client = $("request-client").value.trim();
    if(!title || !client) return;
    const request = {id:crypto.randomUUID(),title,client,assignee:$("request-assignee").value,due:$("request-due").value,status:"En cola",notes:$("request-notes").value.trim()};
    state.requests.push(request);
    state.events.push({id:crypto.randomUUID(),action:"Solicitud creada",detail:title,at:new Date().toLocaleString("es-CO"),by:state.currentUser?.name || "Sistema"});
    persist();
    $("request-form").reset();
    $("request-dialog").close();
    renderDashboard(); renderRequests();
  }

  function changeStatus(id,status){
    const r = state.requests.find(x => x.id === id);
    if(!r) return;
    const old = r.status; r.status = status;
    state.events.push({id:crypto.randomUUID(),action:"Estado actualizado",detail:`${r.title}: ${old} → ${status}`,at:new Date().toLocaleString("es-CO"),by:state.currentUser?.name || "Sistema"});
    persist(); renderRequests(); renderDashboard();
  }

  function renderApp(){
    $("login-view").hidden = true; $("app").hidden = false;
    $("current-user").textContent = `${state.currentUser.name} · ${state.currentUser.role}`;
    showView("dashboard");
  }

  $("login-form").addEventListener("submit", e => {
    e.preventDefault();
    if(!login($("login-user").value)) $("login-message").textContent = "Usuario no reconocido en esta V1.";
  });
  $("logout-btn").addEventListener("click", logout);
  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  $("new-request-btn").addEventListener("click", addRequest);
  document.querySelectorAll(".new-request-trigger").forEach(b => b.addEventListener("click", addRequest));
  $("request-form").addEventListener("submit", saveRequest);
  $("request-search").addEventListener("input", renderRequests);
  $("request-status").addEventListener("change", renderRequests);
  $("request-table-body").addEventListener("change", e => { if(e.target.matches("[data-status-id]")) changeStatus(e.target.dataset.statusId,e.target.value); });
  $("new-client-btn").addEventListener("click", () => alert("Módulo de clientes: formulario completo en la siguiente iteración V1.1."));

  if(state.currentUser) renderApp();
})();
