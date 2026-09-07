lucide.createIcons();

/* =========================================
   UTILITIES & UI CORE (Seguridad y Sanitización)
   ========================================= */
const escapeHTML = (str) => {
    if (!str) return '';
    // Protege contra inyección XSS pero respeta símbolos como <3 sin doble-escape
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    return String(str).replace(/[&<>"'`=\/]/g, s => entityMap[s]);
};

// ----------------------------------------------------------------------
// CONFIGURACIÓN SUPABASE (SINGLE SOURCE OF TRUTH)
// ----------------------------------------------------------------------
const SUPABASE_URL = "https://gbltrfqxohrmkopanghx.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_6tEj9AVvkEbGzlfZMAeW_w_yE0nVnSU"; 

let supabaseClient = null;

if (SUPABASE_URL !== "") {
    if (typeof supabase !== 'undefined') {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch(e) {
            console.warn("Error al inicializar Supabase.", e);
        }
    }
}

class UI {
    static showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'alert-circle';
        
        toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${escapeHTML(message)}</span>`;
        container.appendChild(toast);
        lucide.createIcons();
        
        setTimeout(() => { if(toast.parentElement) toast.remove(); }, 3200);
    }

    static updateConnectionStatus(isOnline, errMessage = null) {
        const el = document.getElementById('connectionStatus');
        const txt = document.getElementById('statusText');
        if (!el || !txt) return;
        
        if (isOnline) {
            el.classList.add('online');
            txt.textContent = 'En línea (Nube)';
        } else {
            el.classList.remove('online');
            txt.textContent = 'Modo Local';
            if (errMessage) console.error("Conexión rechazada:", errMessage);
        }
    }
}

/* =========================================
   CAPA DE SERVICIOS (PERSISTENCIA Y AUTH)
   ========================================= */
const DataService = {
    getUsers: async () => {
        let users = [];
        try {
            const data = localStorage.getItem('db_users');
            if (data) users = JSON.parse(data);
        } catch(e) {}

        let baseUsers = typeof INITIAL_USERS !== 'undefined' ? INITIAL_USERS : [];
        const allUsersMap = new Map();

        baseUsers.forEach(u => allUsersMap.set(u.username, { ...u })); 
        
        users.forEach(u => {
            if (u && typeof u.username === 'string') {
                if(allUsersMap.has(u.username)) {
                    let existing = allUsersMap.get(u.username);
                    existing.avatar = u.avatar || existing.avatar || "";
                    existing.theme = u.theme || existing.theme || '#4f46e5';
                    allUsersMap.set(u.username, existing);
                } else {
                    allUsersMap.set(u.username, { ...u });
                }
            }
        });

        const finalUsers = Array.from(allUsersMap.values());
        localStorage.setItem('db_users', JSON.stringify(finalUsers));
        return finalUsers;
    },
    saveUsers: async (users) => {
        try { localStorage.setItem('db_users', JSON.stringify(users)); } catch (e) {
            if (e.name === 'QuotaExceededError') UI.showToast("Error: Memoria llena. La imagen es muy pesada.", "error");
        }
    },
    
    getTasks: async () => {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from('tasks').select('*');
                if (error) UI.updateConnectionStatus(false, error.message);
                else if (data) { UI.updateConnectionStatus(true); return data; }
            } catch(e) { UI.updateConnectionStatus(false); }
        } else { UI.updateConnectionStatus(false); }
        try { return JSON.parse(localStorage.getItem('db_tasks')) || []; } catch(e) { return []; }
    },
    saveTasks: async (tasks) => {
        localStorage.setItem('db_tasks', JSON.stringify(tasks));
        if (supabaseClient) {
            try { await supabaseClient.from('tasks').upsert(tasks); } catch(e) {}
        }
    },

    getNotes: async () => {
        if (supabaseClient) {
            try {
                // ASCendente para mostrar el chat de arriba hacia abajo
                const { data, error } = await supabaseClient.from('notes').select('*').order('created_at', { ascending: true });
                if (!error && data) return data;
            } catch(e) {}
        }
        try { return JSON.parse(localStorage.getItem('db_notes')) || []; } catch(e) { return []; }
    },
    saveNote: async (note) => {
        let notes = [];
        try { notes = JSON.parse(localStorage.getItem('db_notes')) || []; } catch(e) {}
        notes.push(note);
        localStorage.setItem('db_notes', JSON.stringify(notes));
        if (supabaseClient) {
            try { await supabaseClient.from('notes').insert([note]); } catch(e) {}
        }
    },
    
    getMembers: async () => {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from('members').select('name');
                if (!error && data) return data.map(d => d.name);
            } catch(e) {}
        }
        try { return JSON.parse(localStorage.getItem('db_members')) || ['Camilo', 'David', 'Mafe']; } catch(e) { return []; }
    },
    addMember: async (name) => {
        if (supabaseClient) await supabaseClient.from('members').upsert([{ name }]);
    },
    removeMember: async (name) => {
        if (supabaseClient) await supabaseClient.from('members').delete().eq('name', name);
    },
    saveMembers: async (m) => localStorage.setItem('db_members', JSON.stringify(m)),
    
    getRequesters: async () => {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from('requesters').select('name');
                if (!error && data) return data.map(d => d.name);
            } catch(e) {}
        }
        try { return JSON.parse(localStorage.getItem('db_reqs')) || ['Comunicaciones Internas', 'Comercial', 'Mkt Interno']; } catch (e) { return []; }
    },
    addRequester: async (name) => {
        if (supabaseClient) await supabaseClient.from('requesters').upsert([{ name }]);
    },
    removeRequester: async (name) => {
        if (supabaseClient) await supabaseClient.from('requesters').delete().eq('name', name);
    },
    saveRequesters: async (r) => localStorage.setItem('db_reqs', JSON.stringify(r))
};

const AuthService = {
    login: async (username, password) => {
        const users = await DataService.getUsers();
        const userClean = escapeHTML(username.trim().toLowerCase());
        const passClean = password.trim(); 
        const match = users.find(u => u && typeof u.username === 'string' && u.username.toLowerCase() === userClean && u.password === passClean);
        if (match) {
            localStorage.setItem('auth_user', JSON.stringify({ username: match.username, name: match.name, role: match.role, avatar: match.avatar, theme: match.theme }));
            return true;
        }
        return false;
    },
    logout: () => {
        localStorage.removeItem('auth_user');
        window.location.reload();
    },
    getUser: () => {
        try {
            const item = localStorage.getItem('auth_user');
            return item ? JSON.parse(item) : null;
        } catch (e) { return null; }
    }
};

const initDemoData = async () => {
    if (!localStorage.getItem('dh_first_load')) {
        const tasks = await DataService.getTasks();
        if (tasks.length === 0) {
            await DataService.saveTasks([
                {id: "1", name: "Rediseño Logo Corporativo", requester: "Comercial", assignee: "Camilo", status: "En curso", dateReceived: "2026-08-20", dateDelivered: "2026-08-30"}
            ]);
        }
        if (supabaseClient) {
            const currentMembers = await DataService.getMembers();
            if(currentMembers.length === 0) await supabaseClient.from('members').upsert([{name: 'Camilo'}, {name: 'David'}, {name: 'Mafe'}]);
            const currentReqs = await DataService.getRequesters();
            if(currentReqs.length === 0) await supabaseClient.from('requesters').upsert([{name: 'Comunicaciones Internas'}, {name: 'Comercial'}, {name: 'Mkt Interno'}]);
        }
        localStorage.setItem('dh_first_load', '1');
    }
};

/* =========================================
   UI COMPONENT: CUSTOM DROPDOWNS 
   ========================================= */
function buildCustomSelects(container = document) {
    container.querySelectorAll('.select-wrapper').forEach(w => {
        const select = w.querySelector('select');
        if (select) { w.parentNode.insertBefore(select, w); select.style.display = ''; }
        w.remove();
    });

    container.querySelectorAll('select.native-select-hidden').forEach(select => {
        const wrapper = document.createElement('div');
        wrapper.className = 'select-wrapper';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        
        const trigger = document.createElement('div');
        trigger.setAttribute('tabindex', '0'); 
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('aria-haspopup', 'listbox');
        
        const classNames = Array.from(select.classList).filter(c => c !== 'native-select-hidden').join(' ');
        trigger.className = `select-trigger ${classNames}`;
        
        const safeText = escapeHTML(select.options[select.selectedIndex]?.text || '');
        trigger.innerHTML = `<span>${safeText}</span> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        
        const applyColor = (color) => {
            if (color && color !== '#94a3b8') {
                trigger.style.color = color;
                trigger.style.backgroundColor = color + '20';
                trigger.style.borderColor = color + '40';
            } else {
                trigger.style.color = 'var(--text-muted)';
                trigger.style.backgroundColor = 'var(--bg-subtle)';
                trigger.style.borderColor = 'var(--border-light)';
            }
        };

        applyColor(select.getAttribute('data-color'));

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'select-options';
        optionsDiv.setAttribute('role', 'listbox');

        Array.from(select.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = `select-option ${opt.selected ? 'selected' : ''}`;
            item.textContent = opt.text; 
            item.setAttribute('role', 'option');
            item.setAttribute('tabindex', '-1');
            
            const handleSelect = (e) => {
                e.stopPropagation();
                select.value = opt.value;
                trigger.querySelector('span').textContent = opt.text;
                
                if (select.classList.contains('inline-assignee')) {
                    const newColor = App.getColor(opt.value);
                    select.setAttribute('data-color', newColor);
                    applyColor(newColor);
                }

                select.dispatchEvent(new Event('change'));
                optionsDiv.classList.remove('open');
                trigger.classList.remove('active');
                Array.from(optionsDiv.children).forEach(c => c.classList.remove('selected'));
                item.classList.add('selected');
                trigger.focus();
            };

            item.addEventListener('click', handleSelect);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(e); }
            });
            optionsDiv.appendChild(item);
        });

        const toggleDropdown = (e) => {
            e.stopPropagation();
            const isOpen = optionsDiv.classList.contains('open');
            document.querySelectorAll('.select-options').forEach(o => o.classList.remove('open'));
            document.querySelectorAll('.select-trigger').forEach(t => t.classList.remove('active'));
            
            if (!isOpen) { 
                const rect = trigger.getBoundingClientRect();
                if (window.innerHeight - rect.bottom < 200) {
                    optionsDiv.style.top = 'auto'; optionsDiv.style.bottom = 'calc(100% + 6px)';
                } else {
                    optionsDiv.style.top = 'calc(100% + 6px)'; optionsDiv.style.bottom = 'auto';
                }
                optionsDiv.classList.add('open'); trigger.classList.add('active'); 
                const firstOpt = optionsDiv.querySelector('.select-option');
                if (firstOpt) firstOpt.focus();
            }
        };

        trigger.addEventListener('click', toggleDropdown);
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDropdown(e); }
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsDiv);
    });
    lucide.createIcons();
}

function updateCustomSelectUI(selectElement, value) {
    selectElement.value = value;
    const wrapper = selectElement.closest('.select-wrapper');
    if (wrapper) {
        const triggerSpan = wrapper.querySelector('.select-trigger span');
        const option = Array.from(selectElement.options).find(o => o.value === value);
        if (triggerSpan && option) triggerSpan.textContent = option.text;
        wrapper.querySelectorAll('.select-option').forEach(opt => {
            opt.classList.toggle('selected', opt.textContent === option?.text);
        });
    }
}

/* =========================================
   CONTROLADOR DE LA APP
   ========================================= */
const App = {
    user: null,
    originalTasks: [], 
    tasks: [],         
    members: [],
    requesters: [],
    usersList: [],
    notes: [],
    filterDates: [],
    fpInstances: [],
    hasUnsavedChanges: false,
    cropperInstance: null,

    async init() {
        await initDemoData();
        this.user = AuthService.getUser();
        
        if (!this.user) {
            this.showLogin();
            return; 
        }

        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('currentUserName').textContent = escapeHTML(this.user.name);
        document.getElementById('btnLogout').addEventListener('click', AuthService.logout);

        this.updateAvatarUI();

        if (this.user.role === 'editor') {
            document.querySelectorAll('.admin-only').forEach(el => el.remove());
        }

        await this.loadData();
        this.setupPlugins();
        this.setupEventListeners();
        this.setupNotesPanel();
        this.renderAll();
        
        this.setupCrossTabSync();
        this.setupRealtimeSubscription();
    },

    showLogin() {
        document.getElementById('authOverlay').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        
        const togglePwdBtn = document.getElementById('togglePasswordBtn');
        const pwdInput = document.getElementById('passwordInput');
        if (togglePwdBtn && pwdInput) {
            togglePwdBtn.addEventListener('click', (e) => {
                e.preventDefault(); 
                const isPassword = pwdInput.type === 'password';
                pwdInput.type = isPassword ? 'text' : 'password';
                togglePwdBtn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
                lucide.createIcons();
            });
        }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('usernameInput').value;
            const pass = document.getElementById('passwordInput').value;
            
            try {
                if (await AuthService.login(user, pass)) window.location.reload();
                else document.getElementById('loginError').style.display = 'block';
            } catch (err) {
                UI.showToast("Error al iniciar sesión.", "error");
            }
        });
    },

    setupCrossTabSync() {
        window.addEventListener('storage', async (e) => {
            if (e.key && e.key.startsWith('db_')) {
                await this.loadData();
                this.renderAll();
                if(e.key === 'db_notes') this.renderNotes();
            }
        });
    },

    setupRealtimeSubscription() {
        if (supabaseClient) {
            supabaseClient
                .channel('public-changes')
                .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
                    
                    if (payload.table === 'notes') {
                        const panel = document.getElementById('notesPanel');
                        if(panel && !panel.classList.contains('open')) {
                            document.getElementById('btnToggleNotes').querySelector('.notification-badge')?.classList.add('active');
                        }
                    } else {
                        UI.showToast(`Actualización Recibida`, "info");
                    }
                    
                    await this.loadData();
                    this.renderAll();
                    this.renderNotes();
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') console.log("Conectado a WebSockets");
                });
        }
    },

    updateAvatarUI() {
        const avatarEl = document.getElementById('userAvatar');
        const previewEl = document.getElementById('previewAvatar');
        const sendBtn = document.getElementById('btnSendNote');
        
        const themeColor = this.user.theme || '#4f46e5';
        let avatarUrl = this.user.avatar;
        
        if (!avatarUrl) {
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.name)}&background=${themeColor.replace('#', '')}20&color=${themeColor.replace('#', '')}&font-size=0.33&bold=true`;
        }
        
        if(avatarEl) avatarEl.src = avatarUrl;
        if(previewEl) previewEl.src = avatarUrl;
        if(sendBtn) sendBtn.style.backgroundColor = themeColor; 
    },

    async loadData() {
        this.originalTasks = await DataService.getTasks();
        this.tasks = JSON.parse(JSON.stringify(this.originalTasks));
        this.members = await DataService.getMembers();
        this.requesters = await DataService.getRequesters();
        this.usersList = await DataService.getUsers();
        this.notes = await DataService.getNotes();
    },

    setupPlugins() {
        flatpickr(".date-range-picker", {
            mode: "range", locale: "es", dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", disableMobile: "true",
            onChange: (dates) => { this.filterDates = dates; this.renderBoard(); }
        });
        
        flatpickr(".modal-date", { 
            locale: "es", dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", disableMobile: "true",
            appendTo: document.body 
        });
    },

    markAsUnsaved() {
        this.hasUnsavedChanges = true;
        document.getElementById('unsavedChangesBar').classList.add('active');
    },

    async saveChanges() {
        await DataService.saveTasks(this.tasks);
        this.originalTasks = JSON.parse(JSON.stringify(this.tasks));
        this.hasUnsavedChanges = false;
        document.getElementById('unsavedChangesBar').classList.remove('active');
        UI.showToast("Cambios guardados con éxito", "success");
        this.renderBoard(); 
    },

    undoChanges() {
        this.tasks = JSON.parse(JSON.stringify(this.originalTasks));
        this.hasUnsavedChanges = false;
        document.getElementById('unsavedChangesBar').classList.remove('active');
        UI.showToast("Cambios revertidos", "info");
        this.renderBoard();
    },

    setupEventListeners() {
        document.getElementById('btnSave').addEventListener('click', () => this.saveChanges());
        document.getElementById('btnUndo').addEventListener('click', () => this.undoChanges());

        const mTask = document.getElementById('modalTask');
        document.getElementById('btnNewTask').addEventListener('click', () => {
            // Algoritmo local seguro para "hoy" YYYY-MM-DD
            const d = new Date();
            const todayLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            
            const dateRecInput = document.getElementById('dateReceived');
            if(dateRecInput._flatpickr) dateRecInput._flatpickr.setDate(todayLocal);
            else dateRecInput.value = todayLocal;
            
            mTask.classList.add('active');
        });
        
        this.setupProfileListeners();
        this.setupAdminListeners();

        document.querySelectorAll('.close-modal').forEach(b => {
            if(b.id !== 'closeProfileModalBtn') {
                b.addEventListener('click', e => e.target.closest('.modal-overlay').classList.remove('active'));
            }
        });
        
        ['filterAssignee', 'filterRequester', 'filterStatus', 'filterSort'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', () => this.renderBoard());
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            ['filterAssignee', 'filterRequester', 'filterStatus'].forEach(id => document.getElementById(id).value = 'Todos');
            document.getElementById('filterSort').value = 'asc';
            this.filterDates = [];
            const fpInput = document.getElementById('filterDate');
            if(fpInput && fpInput._flatpickr) fpInput._flatpickr.clear();
            this.renderBoard();
            buildCustomSelects(document.querySelector('.inline-filters-bar')); 
            UI.showToast("Filtros limpiados", "info");
        });

        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            let dateReceivedValue = escapeHTML(document.getElementById('dateReceived').value);
            if (!dateReceivedValue) {
                const d = new Date();
                dateReceivedValue = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            }
            
            const dateDelivered = escapeHTML(document.getElementById('dateDelivered').value);
            
            if (dateDelivered && new Date(dateDelivered) < new Date(dateReceivedValue)) {
                UI.showToast("La entrega no puede ser anterior a la solicitud.", "error"); 
                return;
            }

            this.tasks.push({
                id: Date.now().toString(),
                name: escapeHTML(document.getElementById('taskName').value),
                requester: escapeHTML(document.getElementById('requesterSelect').value),
                assignee: escapeHTML(document.getElementById('assignee').value),
                status: escapeHTML(document.getElementById('status').value),
                dateReceived: dateReceivedValue, 
                dateDelivered: dateDelivered
            });
            
            this.markAsUnsaved(); 
            e.target.reset();
            document.getElementById('modalTask').classList.remove('active');
            UI.showToast("Solicitud añadida", "success");
            this.renderBoard();
        });

        document.getElementById('editTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('editTaskId').value;
            const task = this.tasks.find(t => t.id === id);
            
            if (task) {
                const newRecDate = escapeHTML(document.getElementById('editDateReceived').value);
                
                if (task.dateDelivered && new Date(task.dateDelivered) < new Date(newRecDate)) {
                    UI.showToast("La solicitud no puede superar la entrega.", "error"); 
                    return;
                }

                task.name = escapeHTML(document.getElementById('editTaskName').value);
                task.requester = escapeHTML(document.getElementById('editRequesterSelect').value);
                task.dateReceived = newRecDate;
                
                this.markAsUnsaved();
                document.getElementById('modalEditTask').classList.remove('active');
                UI.showToast("Solicitud editada", "success");
                this.renderBoard();
            }
        });
    },

    setupNotesPanel() {
        const btnToggle = document.getElementById('btnToggleNotes');
        const panel = document.getElementById('notesPanel');
        const overlay = document.getElementById('notesPanelOverlay');
        const btnClose = document.getElementById('btnCloseNotes');
        const form = document.getElementById('noteForm');

        btnToggle.innerHTML += `<div class="notification-badge"></div>`;

        const openPanel = () => {
            panel.classList.add('open');
            overlay.classList.add('active');
            btnToggle.querySelector('.notification-badge').classList.remove('active');
            this.renderNotes();
        };

        const closePanel = () => {
            panel.classList.remove('open');
            overlay.classList.remove('active');
        };

        btnToggle.addEventListener('click', openPanel);
        btnClose.addEventListener('click', closePanel);
        overlay.addEventListener('click', closePanel);

        document.querySelectorAll('.quick-emoji').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById('noteInput');
                input.value += btn.textContent;
                input.focus();
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('noteInput');
            const text = input.value.trim();
            if(!text) return;

            // NO escapamos aquí. Se guarda RAW para evitar doble-escapado
            const newNote = {
                id: Date.now().toString(),
                author: this.user.name,
                content: text, 
                created_at: new Date().toISOString()
            };

            await DataService.saveNote(newNote);
            this.notes.push(newNote);
            input.value = '';
            this.renderNotes();
        });
    },

    renderNotes() {
        const container = document.getElementById('notesList');
        if (!container) return;
        
        container.innerHTML = '';
        if (this.notes.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top:20px;">No hay notas del equipo aún.</p>';
            return;
        }

        this.notes.forEach(n => {
            const dateObj = new Date(n.created_at);
            const dateStr = `${dateObj.getDate().toString().padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
            
            const isMine = n.author === this.user.name;
            const alignClass = isMine ? 'mine' : 'other';
            const authorText = isMine ? 'Tú' : escapeHTML(n.author);
            const authorColor = this.getColor(n.author);

            // Contraste Accesible (WCAG): Blanco sobre el color del usuario si es suyo. Gris sobre blanco si es de otro.
            const bubbleStyle = isMine 
                ? `background-color: ${authorColor}; color: #ffffff; border: none;`
                : `background-color: var(--card-bg); color: var(--text-dark); border: 1px solid var(--border-light); border-left: 4px solid ${authorColor};`;
            const nameStyle = isMine ? `color: var(--text-muted);` : `color: ${authorColor};`;

            // Doble-escape prevenido
            container.innerHTML += `
                <div class="chat-msg ${alignClass}">
                    <div class="chat-meta">
                        <span style="${nameStyle} font-weight: 700;">${authorText}</span> 
                        <span>${dateStr}</span>
                    </div>
                    <div class="chat-bubble" style="${bubbleStyle}">
                        ${escapeHTML(n.content)}
                    </div>
                </div>
            `;
        });
        
        container.scrollTop = container.scrollHeight;
    },

    openEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskName').value = task.name;
        
        const reqSelect = document.getElementById('editRequesterSelect');
        updateCustomSelectUI(reqSelect, task.requester);

        const recInput = document.getElementById('editDateReceived');
        if(recInput._flatpickr) {
            recInput._flatpickr.setDate(task.dateReceived || '');
        } else {
            recInput.value = task.dateReceived || '';
        }

        document.getElementById('modalEditTask').classList.add('active');
    },

    toggleTaskStatus(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const newStatus = task.status === 'En curso' ? 'En cola' : 'En curso';
        task.status = newStatus;
        
        const element = document.getElementById(`status-switch-${taskId}`);
        if (element) {
            const isCurso = newStatus === 'En curso';
            element.className = `status-switch ${isCurso ? 'curso' : 'cola'}`;
            element.setAttribute('aria-checked', isCurso ? 'true' : 'false');
            element.innerHTML = `
                <div class="switch-track"><div class="switch-thumb"></div></div>
                <span class="switch-label">${newStatus}</span>
            `;
        }

        this.markAsUnsaved();
        this.renderWorkloadChart(this.tasks.filter(x => x.status !== 'Entregado'));
    },

    setupProfileListeners() {
        const mProfile = document.getElementById('modalProfile');
        const fileInput = document.getElementById('avatarFileInput');
        const urlInput = document.getElementById('avatarUrlInput');
        const swatches = document.querySelectorAll('.color-swatch');
        const cropperWrapper = document.getElementById('cropperWrapper');
        const cropperImage = document.getElementById('cropperImage');
        const avatarPreviewContainer = document.getElementById('avatarPreviewContainer');
        const urlDivider = document.getElementById('urlDivider');
        const urlFieldGroup = document.getElementById('urlFieldGroup');
        const btnCancelCrop = document.getElementById('btnCancelCrop');
        const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');

        let selectedTheme = this.user.theme || '#4f46e5';

        const checkTakenColors = () => {
            const takenColors = this.usersList.filter(u => u.username !== this.user.username).map(u => u.theme);
            swatches.forEach(swatch => {
                const c = swatch.getAttribute('data-color');
                if (takenColors.includes(c)) {
                    swatch.style.opacity = '0.3';
                    swatch.style.cursor = 'not-allowed';
                    swatch.title = 'Color en uso por otro compañero';
                    swatch.onclick = (e) => { e.stopPropagation(); UI.showToast("Este color ya está en uso", "error"); };
                } else {
                    swatch.style.opacity = '1';
                    swatch.style.cursor = 'pointer';
                    swatch.title = '';
                    swatch.onclick = (e) => {
                        swatches.forEach(s => s.classList.remove('active'));
                        swatch.classList.add('active');
                        selectedTheme = escapeHTML(swatch.getAttribute('data-color'));
                    };
                }
            });
        };

        const resetProfileModal = () => {
            if (this.cropperInstance) {
                this.cropperInstance.destroy();
                this.cropperInstance = null;
            }
            fileInput.value = '';
            cropperWrapper.style.display = 'none';
            btnCancelCrop.style.display = 'none';
            avatarPreviewContainer.style.display = 'block';
            urlDivider.style.display = 'block';
            urlFieldGroup.style.display = 'block';
            document.getElementById('btnSaveProfile').textContent = 'Guardar Cambios';
            this.updateAvatarUI();
        };

        const saveAndClose = async (avatarData) => {
            this.user.avatar = avatarData;
            this.user.theme = selectedTheme;
            localStorage.setItem('auth_user', JSON.stringify(this.user));
            
            let allUsers = await DataService.getUsers();
            let dbUser = allUsers.find(u => u.username === this.user.username);
            if(dbUser) {
                dbUser.avatar = avatarData;
                dbUser.theme = selectedTheme;
                try {
                    await DataService.saveUsers(allUsers);
                    UI.showToast("Perfil actualizado correctamente", "success");
                } catch (e) { return; }
            }

            this.usersList = await DataService.getUsers();
            this.updateAvatarUI();
            resetProfileModal();
            mProfile.classList.remove('active');
            this.renderAll(); 
            this.renderNotes();
        };

        document.getElementById('userProfileBtn').addEventListener('click', () => {
            resetProfileModal();
            urlInput.value = this.user.avatar && this.user.avatar.startsWith('http') ? this.user.avatar : '';
            selectedTheme = this.user.theme || '#4f46e5';
            checkTakenColors();
            swatches.forEach(s => s.classList.remove('active'));
            const activeSwatch = document.querySelector(`.color-swatch[data-color="${selectedTheme}"]`);
            if(activeSwatch) activeSwatch.classList.add('active');
            mProfile.classList.add('active');
        });

        document.getElementById('closeProfileModalBtn').addEventListener('click', () => {
            resetProfileModal();
            mProfile.classList.remove('active');
        });

        btnCancelCrop.addEventListener('click', resetProfileModal);

        btnRemoveAvatar.addEventListener('click', () => {
            if (confirm('¿Seguro que deseas eliminar tu foto y volver a tus iniciales?')) saveAndClose("");
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    cropperImage.src = event.target.result;
                    avatarPreviewContainer.style.display = 'none';
                    urlDivider.style.display = 'none';
                    urlFieldGroup.style.display = 'none';
                    cropperWrapper.style.display = 'block';
                    btnCancelCrop.style.display = 'flex';
                    document.getElementById('btnSaveProfile').textContent = 'Confirmar y Guardar';

                    if (this.cropperInstance) this.cropperInstance.destroy();
                    this.cropperInstance = new Cropper(cropperImage, {
                        aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 1,
                    });
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.cropperInstance) {
                const canvas = this.cropperInstance.getCroppedCanvas({ width: 256, height: 256 });
                saveAndClose(canvas.toDataURL('image/webp', 0.5));
            } else if (urlInput.value.trim() !== '') {
                saveAndClose(escapeHTML(urlInput.value.trim()));
            } else {
                saveAndClose(this.user.avatar || ""); 
            }
        });
    },

    setupAdminListeners() {
        if (this.user.role !== 'admin') return;

        document.getElementById('btnManageTeam').addEventListener('click', () => document.getElementById('modalTeam').classList.add('active'));
        document.getElementById('btnManageReq').addEventListener('click', () => document.getElementById('modalRequesters').classList.add('active'));
        
        document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('newMemberInput');
            const name = escapeHTML(input.value.trim());
            if (name && !this.members.some(m => m.toLowerCase() === name.toLowerCase())) {
                this.members.push(name); 
                
                await DataService.addMember(name);
                await DataService.saveMembers(this.members);
                
                const themeOptions = ['#4f46e5', '#2563eb', '#0284c7', '#0891b2', '#0d9488', '#059669', '#16a34a', '#84cc16', '#f59e0b', '#ea580c', '#dc2626', '#e11d48', '#db2777', '#c026d3', '#7c3aed'];
                const randomTheme = themeOptions[Math.floor(Math.random() * themeOptions.length)];

                let dbUsers = await DataService.getUsers();
                if (!dbUsers.some(u => u.username === name.toLowerCase())) {
                    dbUsers.push({ username: name.toLowerCase(), password: `${name}_DH2026!`, role: "editor", name: name, avatar: "", theme: randomTheme });
                    await DataService.saveUsers(dbUsers);
                }

                this.usersList = await DataService.getUsersSoy un modelo de lenguage, por lo que no me han diseñado para eso.
