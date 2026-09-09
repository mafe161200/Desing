lucide.createIcons();

/* =========================================
   UTILITIES & UI CORE (Seguridad y Sanitización)
   ========================================= */
const escapeHTML = (str) => {
    if (!str) return '';
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

const CONFIG = Object.freeze({
    supabaseUrl: "https://gbltrfqxohrmkopanghx.supabase.co",
    supabasePublishableKey: "sb_publishable_6tEj9AVvkEbGzlfZMAeW_w_yE0nVnSU",
    demoDataEnabled: true,
    localStorageKeys: Object.freeze({
        users: 'db_users',
        tasks: 'db_tasks',
        notes: 'db_notes',
        members: 'db_members',
        requesters: 'db_reqs',
        authUser: 'auth_user',
        firstLoad: 'dh_first_load'
    })
});

const normalizeText = (value) => String(value ?? '').trim();

const normalizeUsername = (value) => normalizeText(value).toLowerCase();

const createId = () => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

const getLocalJSON = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch (error) {
        console.warn(`No se pudo leer "${key}" desde LocalStorage.`, error);
        return fallback;
    }
};

const setLocalJSON = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        if (error?.name === 'QuotaExceededError') {
            UI.showToast("Error: la memoria local está llena.", "error");
        } else {
            console.error(`No se pudo guardar "${key}" en LocalStorage.`, error);
        }
        return false;
    }
};

const sanitizeAvatarUrl = (value) => {
    const url = normalizeText(value);
    if (!url) return '';

    if (url.startsWith('data:image/')) return url;

    try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            return parsed.href;
        }
    } catch (error) {
        console.warn('URL de avatar inválida.', error);
    }

    return '';
};

// ----------------------------------------------------------------------
// CONFIGURACIÓN SUPABASE
// ----------------------------------------------------------------------
let supabaseClient = null;

if (CONFIG.supabaseUrl && typeof supabase !== 'undefined') {
    try {
        supabaseClient = supabase.createClient(
            CONFIG.supabaseUrl,
            CONFIG.supabasePublishableKey
        );
    } catch (error) {
        console.warn("Error al inicializar Supabase.", error);
    }
}

class UI {
    static showToast(message, type = 'info', duration = 8000, onClickCallback = null) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'alert-circle';
        if (type === 'warning') icon = 'alert-triangle';
        
        toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${escapeHTML(message)}</span>`;
        
        if (onClickCallback) {
            toast.classList.add('toast-clickable');
            toast.title = "Haz clic para ir a la tarea";
            toast.addEventListener('click', () => {
                onClickCallback();
                toast.classList.add('fade-out');
                setTimeout(() => { if(toast.parentElement) toast.remove(); }, 300);
            });
        }
        
        container.appendChild(toast);
        lucide.createIcons();
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => { if(toast.parentElement) toast.remove(); }, 300);
        }, duration);
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

// ----------------------------------------------------------------------
// SERVICIO DE NOTIFICACIONES (Clean Architecture)
// ----------------------------------------------------------------------
const NotificationService = {
    checkStartupAlerts: (tasks, userName) => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        
        // Enrutamiento Visual (Callback para ir a la tarea)
        const highlightTask = (taskId) => {
            // Limpiamos filtros para asegurar que la tarea se muestre
            document.getElementById('filterAssignee').value = 'Todos';
            document.getElementById('filterRequester').value = 'Todos';
            document.getElementById('filterStatus').value = 'Todos';
            App.filterDates = [];
            const fpInput = document.getElementById('filterDate');
            if(fpInput && fpInput._flatpickr) fpInput._flatpickr.clear();
            
            App.renderBoard(); // Forzar renderizado sin filtros
            
            setTimeout(() => {
                // Buscamos la fila en la tabla principal
                const row = document.getElementById(`tr-${taskId}`);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.classList.remove('task-highlight-pulse');
                    void row.offsetWidth; // Reflow
                    row.classList.add('task-highlight-pulse');
                    setTimeout(() => row.classList.remove('task-highlight-pulse'), 3000);
                }
                // Si la pantalla es pequeña y estamos viendo el sidebar, también la buscamos ahí
                const li = document.getElementById(`li-${taskId}`);
                if (li && window.innerWidth <= 980) {
                     li.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     li.classList.remove('task-highlight-pulse');
                     void li.offsetWidth;
                     li.classList.add('task-highlight-pulse');
                     setTimeout(() => li.classList.remove('task-highlight-pulse'), 3000);
                }
            }, 100);
        };

        const myPendingTasks = tasks.filter(t => t.assignee === userName && t.status !== 'Entregado' && t.dateDelivered);
        if (myPendingTasks.length > 0) {
            myPendingTasks.sort((a, b) => new Date(a.dateDelivered).getTime() - new Date(b.dateDelivered).getTime());
            const nearest = myPendingTasks[0];
            const callback = () => highlightTask(nearest.id);
            
            if (nearest.dateDelivered < todayStr) {
                 setTimeout(() => UI.showToast(`¡Tienes una tarea vencida!: ${nearest.name}`, 'error', 8000, callback), 1000);
            } else if (nearest.dateDelivered === todayStr) {
                 setTimeout(() => UI.showToast(`Tu tarea más próxima es para hoy: ${nearest.name}`, 'warning', 8000, callback), 1000);
            } else {
                 setTimeout(() => UI.showToast(`Próxima entrega: ${nearest.name} el ${nearest.dateDelivered.split('-').reverse().join('/')}`, 'info', 8000, callback), 1000);
            }
        }

        const unassigned = tasks.filter(t => t.assignee === 'No asignado' && t.status !== 'Entregado' && t.dateReceived);
        const oldUnassigned = unassigned.filter(t => {
            const recDate = new Date(t.dateReceived);
            const diffTime = Math.abs(now - recDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > 3;
        });

        if (oldUnassigned.length > 0) {
            setTimeout(() => UI.showToast(`Hay ${oldUnassigned.length} tarea(s) sin asignar desde hace más de 3 días.`, 'warning', 8000, null), 2500);
        }
    }
};

/* =========================================
   CAPA DE SERVICIOS (PERSISTENCIA Y AUTH)
   ========================================= */
const DataService = {
    async getUsers() {
        const localUsers = getLocalJSON(CONFIG.localStorageKeys.users, []);
        const baseUsers = typeof INITIAL_USERS !== 'undefined' ? INITIAL_USERS : [];
        const allUsersMap = new Map();

        baseUsers.forEach(user => {
            if (user?.username) {
                allUsersMap.set(normalizeUsername(user.username), { ...user });
            }
        });

        localUsers.forEach(user => {
            if (!user?.username) return;

            const key = normalizeUsername(user.username);
            const existing = allUsersMap.get(key);

            if (existing) {
                allUsersMap.set(key, {
                    ...existing,
                    avatar: user.avatar || existing.avatar || "",
                    theme: user.theme || existing.theme || '#4f46e5'
                });
            } else {
                allUsersMap.set(key, { ...user });
            }
        });

        const finalUsers = Array.from(allUsersMap.values());
        setLocalJSON(CONFIG.localStorageKeys.users, finalUsers);
        return finalUsers;
    },

    async saveUsers(users) {
        return setLocalJSON(CONFIG.localStorageKeys.users, users);
    },

    async getTasks() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .select('*');

                if (!error && data) {
                    UI.updateConnectionStatus(true);
                    setLocalJSON(CONFIG.localStorageKeys.tasks, data);
                    return data;
                }

                if (error) {
                    UI.updateConnectionStatus(false, error.message);
                    console.warn('Supabase: no se pudieron cargar las tareas.', error);
                }
            } catch (error) {
                UI.updateConnectionStatus(false, error.message);
                console.warn('Supabase: error cargando tareas.', error);
            }
        } else {
            UI.updateConnectionStatus(false);
        }

        return getLocalJSON(CONFIG.localStorageKeys.tasks, []);
    },

    async saveTasks(tasks) {
        const localSaved = setLocalJSON(CONFIG.localStorageKeys.tasks, tasks);
        let cloudSaved = false;

        if (supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('tasks')
                    .upsert(tasks);

                if (error) {
                    console.error('Supabase: no se pudieron guardar las tareas.', error);
                    UI.updateConnectionStatus(false, error.message);
                } else {
                    cloudSaved = true;
                    UI.updateConnectionStatus(true);
                }
            } catch (error) {
                console.error('Supabase: error guardando tareas.', error);
                UI.updateConnectionStatus(false, error.message);
            }
        }

        return { localSaved, cloudSaved };
    },

    async getNotes() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('notes')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (!error && data) {
                    setLocalJSON(CONFIG.localStorageKeys.notes, data);
                    return data;
                }

                if (error) {
                    console.warn('Supabase: no se pudieron cargar las notas.', error);
                }
            } catch (error) {
                console.warn('Supabase: error cargando notas.', error);
            }
        }

        return getLocalJSON(CONFIG.localStorageKeys.notes, []);
    },

    async saveNote(note) {
        const notes = getLocalJSON(CONFIG.localStorageKeys.notes, []);
        notes.push(note);

        const localSaved = setLocalJSON(CONFIG.localStorageKeys.notes, notes);
        let cloudSaved = false;

        if (supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('notes')
                    .insert([note]);

                if (error) {
                    console.error('Supabase: no se pudo guardar la nota.', error);
                } else {
                    cloudSaved = true;
                }
            } catch (error) {
                console.error('Supabase: error guardando nota.', error);
            }
        }

        return { localSaved, cloudSaved };
    },

    async getMembers() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('members')
                    .select('name');

                if (!error && data) {
                    const members = data.map(item => item.name).filter(Boolean);
                    setLocalJSON(CONFIG.localStorageKeys.members, members);
                    return members;
                }

                if (error) {
                    console.warn('Supabase: no se pudieron cargar los miembros.', error);
                }
            } catch (error) {
                console.warn('Supabase: error cargando miembros.', error);
            }
        }

        return getLocalJSON(
            CONFIG.localStorageKeys.members,
            ['Camilo', 'David', 'Mafe']
        );
    },

    async addMember(name) {
        if (!supabaseClient) return true;

        try {
            const { error } = await supabaseClient
                .from('members')
                .upsert([{ name }]);

            if (error) {
                console.error('Supabase: no se pudo añadir el miembro.', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Supabase: error añadiendo miembro.', error);
            return false;
        }
    },

    async removeMember(name) {
        if (!supabaseClient) return true;

        try {
            const { error } = await supabaseClient
                .from('members')
                .delete()
                .eq('name', name);

            if (error) {
                console.error('Supabase: no se pudo eliminar el miembro.', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Supabase: error eliminando miembro.', error);
            return false;
        }
    },

    async saveMembers(members) {
        return setLocalJSON(CONFIG.localStorageKeys.members, members);
    },

    async getRequesters() {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('requesters')
                    .select('name');

                if (!error && data) {
                    const requesters = data.map(item => item.name).filter(Boolean);
                    setLocalJSON(CONFIG.localStorageKeys.requesters, requesters);
                    return requesters;
                }

                if (error) {
                    console.warn('Supabase: no se pudieron cargar los solicitantes.', error);
                }
            } catch (error) {
                console.warn('Supabase: error cargando solicitantes.', error);
            }
        }

        return getLocalJSON(
            CONFIG.localStorageKeys.requesters,
            ['Comunicaciones Internas', 'Comercial', 'Mkt Interno']
        );
    },

    async addRequester(name) {
        if (!supabaseClient) return true;

        try {
            const { error } = await supabaseClient
                .from('requesters')
                .upsert([{ name }]);

            if (error) {
                console.error('Supabase: no se pudo añadir el solicitante.', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Supabase: error añadiendo solicitante.', error);
            return false;
        }
    },

    async removeRequester(name) {
        if (!supabaseClient) return true;

        try {
            const { error } = await supabaseClient
                .from('requesters')
                .delete()
                .eq('name', name);

            if (error) {
                console.error('Supabase: no se pudo eliminar el solicitante.', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Supabase: error eliminando solicitante.', error);
            return false;
        }
    },

    async saveRequesters(requesters) {
        return setLocalJSON(CONFIG.localStorageKeys.requesters, requesters);
    }
};

const AuthService = {
    login: async (username, password) => {
        const users = await DataService.getUsers();
        const userClean = normalizeUsername(username);
        const passClean = normalizeText(password);

        const match = users.find(user =>
            user &&
            typeof user.username === 'string' &&
            normalizeUsername(user.username) === userClean &&
            user.password === passClean
        );

        if (match) {
            setLocalJSON(CONFIG.localStorageKeys.authUser, {
                username: match.username,
                name: match.name,
                role: match.role,
                avatar: match.avatar,
                theme: match.theme
            });
            return true;
        }

        return false;
    },

    logout: () => {
        localStorage.removeItem(CONFIG.localStorageKeys.authUser);
        window.location.reload();
    },

    getUser: () => getLocalJSON(CONFIG.localStorageKeys.authUser, null)
};

const initDemoData = async () => {
    if (!CONFIG.demoDataEnabled || localStorage.getItem(CONFIG.localStorageKeys.firstLoad)) return;

    {
        const tasks = await DataService.getTasks();
        if (tasks.length === 0) {
            await DataService.saveTasks([
                {id: "1", name: "Rediseño Logo Corporativo", requester: "Comercial", assignee: "Camilo", status: "En curso", dateReceived: "2026-08-20", dateDelivered: "2026-08-30", isStarred: false}
            ]);
        }
        if (supabaseClient) {
            const currentMembers = await DataService.getMembers();
            if(currentMembers.length === 0) await supabaseClient.from('members').upsert([{name: 'Camilo'}, {name: 'David'}, {name: 'Mafe'}]);
            const currentReqs = await DataService.getRequesters();
            if(currentReqs.length === 0) await supabaseClient.from('requesters').upsert([{name: 'Comunicaciones Internas'}, {name: 'Comercial'}, {name: 'Mkt Interno'}]);
        }
        localStorage.setItem(CONFIG.localStorageKeys.firstLoad, '1');
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
        document.getElementById('currentUserName').textContent = normalizeText(this.user.name);
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

        NotificationService.checkStartupAlerts(this.tasks, this.user.name);
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
                        UI.showToast(`Actualización Recibida`, "info", 3000);
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
        let avatarUrl = sanitizeAvatarUrl(this.user.avatar);
        
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
        // Migración retroactiva: Si alguna tarea antigua no tiene el flag booleano, se lo asignamos
        this.tasks.forEach(t => { if (typeof t.isStarred === 'undefined') t.isStarred = false; });

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
        const result = await DataService.saveTasks(this.tasks);

        if (!result.localSaved) {
            UI.showToast("No fue posible guardar los cambios localmente.", "error");
            return;
        }

        this.originalTasks = JSON.parse(JSON.stringify(this.tasks));
        this.hasUnsavedChanges = false;
        document.getElementById('unsavedChangesBar').classList.remove('active');

        if (supabaseClient && !result.cloudSaved) {
            UI.showToast("Guardado localmente. No se pudo sincronizar con la nube.", "warning");
        } else {
            UI.showToast("Cambios guardados con éxito", "success");
        }

        this.renderBoard();
    },

    undoChanges() {
        this.tasks = JSON.parse(JSON.stringify(this.originalTasks));
        this.hasUnsavedChanges = false;
        document.getElementById('unsavedChangesBar').classList.remove('active');
        UI.showToast("Cambios revertidos", "info");
        this.renderBoard();
    },

    toggleTaskStar(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.isStarred = !task.isStarred;
            this.markAsUnsaved();
            this.renderBoard();
        }
    },

    setupEventListeners() {
        document.getElementById('btnSave').addEventListener('click', () => this.saveChanges());
        document.getElementById('btnUndo').addEventListener('click', () => this.undoChanges());

        const mTask = document.getElementById('modalTask');
        document.getElementById('btnNewTask').addEventListener('click', () => {
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
            
            const taskNameRaw = document.getElementById('taskName').value.trim();
            const requesterRaw = document.getElementById('requesterSelect').value;
            
            const isDuplicate = this.tasks.some(t => 
                t.name.toLowerCase() === taskNameRaw.toLowerCase() && 
                t.requester === requesterRaw
            );

            if (isDuplicate) {
                UI.showToast("Ya existe una tarea idéntica para este solicitante.", "error");
                return;
            }
            
            let dateReceivedValue = normalizeText(document.getElementById('dateReceived').value);
            if (!dateReceivedValue) {
                const d = new Date();
                dateReceivedValue = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            }
            
            const dateDelivered = normalizeText(document.getElementById('dateDelivered').value);
            
            if (dateDelivered && new Date(dateDelivered) < new Date(dateReceivedValue)) {
                UI.showToast("La entrega no puede ser anterior a la solicitud.", "error"); 
                return;
            }

            this.tasks.push({
                id: createId(),
                name: taskNameRaw,
                requester: requesterRaw,
                assignee: normalizeText(document.getElementById('assignee').value),
                status: normalizeText(document.getElementById('status').value),
                dateReceived: dateReceivedValue, 
                dateDelivered: dateDelivered,
                isStarred: false // Nueva propiedad
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
                const newRecDate = normalizeText(document.getElementById('editDateReceived').value);
                
                if (task.dateDelivered && new Date(task.dateDelivered) < new Date(newRecDate)) {
                    UI.showToast("La solicitud no puede superar la entrega.", "error"); 
                    return;
                }

                task.name = normalizeText(document.getElementById('editTaskName').value);
                task.requester = normalizeText(document.getElementById('editRequesterSelect').value);
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
            const picker = document.getElementById('emojiPickerWrapper');
            if(picker) picker.style.display = 'none';
        };

        btnToggle.addEventListener('click', openPanel);
        btnClose.addEventListener('click', closePanel);
        overlay.addEventListener('click', closePanel);

        const emojiBtn = document.getElementById('btnToggleEmoji');
        const pickerWrapper = document.getElementById('emojiPickerWrapper');
        const picker = document.querySelector('emoji-picker');
        const input = document.getElementById('noteInput');

        if(emojiBtn && pickerWrapper) {
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                pickerWrapper.style.display = pickerWrapper.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (picker) {
            picker.addEventListener('emoji-click', event => {
                input.value += event.detail.unicode;
                input.focus();
            });
        }

        document.addEventListener('click', (e) => {
            if(pickerWrapper && pickerWrapper.style.display === 'block') {
                if(!pickerWrapper.contains(e.target) && !emojiBtn.contains(e.target)) {
                    pickerWrapper.style.display = 'none';
                }
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if(!text) return;

            const newNote = {
                id: createId(),
                author: this.user.name,
                content: text, 
                created_at: new Date().toISOString()
            };

            const result = await DataService.saveNote(newNote);

            if (!result.localSaved) {
                UI.showToast("No fue posible guardar la nota.", "error");
                return;
            }

            this.notes.push(newNote);
            input.value = '';

            if (supabaseClient && !result.cloudSaved) {
                UI.showToast("Nota guardada localmente; no se pudo sincronizar.", "warning");
            }
            if(pickerWrapper) pickerWrapper.style.display = 'none';
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

            const cleanContent = escapeHTML(n.content);

            container.innerHTML += `
                <div class="chat-msg ${alignClass}">
                    <div class="chat-meta">
                        <span style="color: ${isMine ? 'var(--text-muted)' : authorColor}; font-weight: 700;">${authorText}</span> 
                        <span>${dateStr}</span>
                    </div>
                    <div class="chat-bubble ${isMine ? '' : 'chat-bubble-other'}" style="${isMine ? `background-color: var(--primary-cold); color: #ffffff;` : `border-left-color: ${authorColor};`}">
                        ${cleanContent}
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
                    swatch.classList.add('disabled');
                    swatch.title = 'Color en uso por otro compañero';
                    swatch.onclick = (e) => { e.stopPropagation(); UI.showToast("Este color ya está en uso", "error"); };
                } else {
                    swatch.classList.remove('disabled');
                    swatch.title = '';
                    swatch.onclick = (e) => {
                        swatches.forEach(s => s.classList.remove('active'));
                        swatch.classList.add('active');
                        selectedTheme = swatch.getAttribute('data-color') || selectedTheme;
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
            this.user.avatar = sanitizeAvatarUrl(avatarData);
            this.user.theme = selectedTheme;
            localStorage.setItem('auth_user', JSON.stringify(this.user));
            
            let allUsers = await DataService.getUsers();
            let dbUser = allUsers.find(u => u.username === this.user.username);
            if(dbUser) {
                dbUser.avatar = this.user.avatar;
                dbUser.theme = selectedTheme;
                try {
                    await DataService.saveUsers(allUsers);
                    UI.showToast("Perfil actualizado", "success");
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
                saveAndClose(sanitizeAvatarUrl(urlInput.value));
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
            const name = normalizeText(input.value);
            if (name && !this.members.some(m => m.toLowerCase() === name.toLowerCase())) {
                this.members.push(name); 
                await DataService.addMember(name);
                const localSaved = await DataService.saveMembers(this.members);
                if (!localSaved) {
                    this.members.pop();
                    UI.showToast("No fue posible guardar el colaborador.", "error");
                    return;
                }
                
                const themeOptions = ['#4f46e5', '#2563eb', '#0284c7', '#0891b2', '#0d9488', '#059669', '#16a34a', '#84cc16', '#f59e0b', '#ea580c', '#dc2626', '#e11d48', '#db2777', '#c026d3', '#7c3aed'];
                const randomTheme = themeOptions[Math.floor(Math.random() * themeOptions.length)];

                let dbUsers = await DataService.getUsers();
                if (!dbUsers.some(u => u.username === name.toLowerCase())) {
                    dbUsers.push({ username: name.toLowerCase(), password: `${name}_DH2026!`, role: "editor", name: name, avatar: "", theme: randomTheme });
                    await DataService.saveUsers(dbUsers);
                }

                this.usersList = await DataService.getUsers();
                input.value = ''; 
                this.renderAll();
                UI.showToast("Colaborador añadido", "success");
            }
        });

        window.removeMember = async (index) => { 
            if (confirm('¿Quitar del equipo?')) { 
                const removedName = this.members[index];
                this.members.splice(index, 1); 
                await DataService.removeMember(removedName);
                await DataService.saveMembers(this.members); 

                let dbUsers = await DataService.getUsers();
                dbUsers = dbUsers.filter(u => u.username.toLowerCase() !== removedName.toLowerCase());
                await DataService.saveUsers(dbUsers);

                this.usersList = await DataService.getUsers();
                this.renderAll(); 
                UI.showToast("Colaborador eliminado", "success");
            } 
        };

        document.getElementById('addRequesterForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('newRequesterInput');
            const name = normalizeText(input.value);
            if (name && !this.requesters.some(r => r.toLowerCase() === name.toLowerCase())) {
                this.requesters.push(name); 
                await DataService.addRequester(name);
                const localSaved = await DataService.saveRequesters(this.requesters);
                if (!localSaved) {
                    this.requesters.pop();
                    UI.showToast("No fue posible guardar el solicitante.", "error");
                    return;
                }
                input.value = ''; 
                this.renderAll();
                UI.showToast("Solicitante añadido", "success");
            }
        });
        
        window.removeRequester = async (index) => { 
            if (confirm('¿Eliminar solicitante?')) { 
                const removedName = this.requesters[index];
                this.requesters.splice(index, 1); 
                await DataService.removeRequester(removedName);
                await DataService.saveRequesters(this.requesters); 
                this.renderAll(); 
                UI.showToast("Solicitante eliminado", "success");
            } 
        };
    },

    renderAll() {
        this.renderDropdowns();
        this.renderTags();
        this.renderBoard();
    },

    renderDropdowns() {
        const sAssignee = ['assignee', 'filterAssignee'];
        sAssignee.forEach(id => {
            const el = document.getElementById(id);
            if(!el) return;
            el.innerHTML = id === 'filterAssignee' ? '<option value="Todos">Asignación: Todos</option>' : '';
            el.innerHTML += '<option value="No asignado">No asignado</option>'; 
            this.members.forEach(m => {
                const safeM = escapeHTML(m);
                el.innerHTML += `<option value="${safeM}">${safeM}</option>`;
            });
        });

        const sReq = ['requesterSelect', 'filterRequester', 'editRequesterSelect'];
        sReq.forEach(id => {
            const el = document.getElementById(id);
            if(!el) return;
            el.innerHTML = id === 'filterRequester' ? '<option value="Todos">Solicitante: Todos</option>' : '';
            this.requesters.forEach(r => {
                const safeR = escapeHTML(r);
                el.innerHTML += `<option value="${safeR}">${safeR}</option>`;
            });
        });
        buildCustomSelects(document.querySelector('.inline-filters-bar'));
        buildCustomSelects(document.querySelector('#taskForm'));
        buildCustomSelects(document.querySelector('#editTaskForm'));
    },

    renderTags() {
        if(this.user.role !== 'admin') return;
        const mList = document.getElementById('membersList');
        mList.innerHTML = '';
        this.members.forEach((m) => {
            const safeM = escapeHTML(m);
            const hexColor = this.getColor(m);
            mList.innerHTML += `<div class="member-chip" style="color: ${hexColor}; background-color: ${hexColor}20; border-color: ${hexColor}40;"><span>${safeM}</span><button type="button" class="remove-member" aria-label="Eliminar ${safeM}" onclick="removeMember('${this.members.indexOf(m)}')"><i data-lucide="x"></i></button></div>`;
        });

        const rList = document.getElementById('requestersList');
        rList.innerHTML = '';
        this.requesters.forEach((r, i) => {
            const safeR = escapeHTML(r);
            rList.innerHTML += `<div class="member-chip"><span>${safeR}</span><button type="button" class="remove-member" aria-label="Eliminar ${safeR}" onclick="removeRequester(${i})"><i data-lucide="x"></i></button></div>`;
        });
        lucide.createIcons();
    },

    getColor(name) {
        if (!name || name === 'No asignado') return '#94a3b8';
        const userClean = name.toLowerCase().trim();
        const dbUser = this.usersList.find(u => 
            u && (
                (u.name && u.name.toLowerCase().trim() === userClean) || 
                (u.username && u.username.toLowerCase().trim() === userClean)
            )
        );
        if (dbUser && dbUser.theme) return dbUser.theme;

        const allColors = ['#4f46e5', '#2563eb', '#0284c7', '#0891b2', '#0d9488', '#059669', '#16a34a', '#84cc16', '#f59e0b', '#ea580c', '#dc2626', '#e11d48', '#db2777', '#c026d3', '#7c3aed'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return allColors[Math.abs(hash) % allColors.length];
    },

    updateTask(id, field, value, shouldRender = false) {
        const t = this.tasks.find(x => x.id === id);
        if (t) {
            t[field] = normalizeText(value);
            this.markAsUnsaved(); 
            this.renderWorkloadChart(this.tasks.filter(x => x.status !== 'Entregado'));
            if(shouldRender) this.renderBoard(); 
        }
    },

    renderBoard() {
        const sList = document.getElementById('sidebarList');
        const sCompList = document.getElementById('sidebarCompletedList');
        const tBody = document.getElementById('tablePrioridades');
        
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        
        if (this.fpInstances) {
            const instances = Array.isArray(this.fpInstances) ? this.fpInstances : [this.fpInstances];
            instances.forEach(fp => { if (fp && typeof fp.destroy === 'function') fp.destroy(); });
        }
        this.fpInstances = [];

        sList.innerHTML = ''; sCompList.innerHTML = ''; tBody.innerHTML = '';

        const fAssignee = document.getElementById('filterAssignee').value;
        const fRequester = document.getElementById('filterRequester').value;
        const fStatus = document.getElementById('filterStatus').value;
        const fSortEl = document.getElementById('filterSort');
        const fSort = fSortEl ? fSortEl.value : 'asc';
        const sortModifier = fSort === 'desc' ? -1 : 1;

        let filtered = this.tasks.filter(t => {
            let mAsig = fAssignee === 'Todos' || t.assignee === fAssignee;
            let mReq = fRequester === 'Todos' || t.requester === fRequester;
            let mStat = fStatus === 'Todos' || t.status === fStatus;
            let mDate = true;
            if (this.filterDates.length > 0) {
                if(!t.dateDelivered) {
                    mDate = false;
                } else {
                    const start = new Date(this.filterDates[0]); start.setHours(0,0,0,0);
                    const end = this.filterDates.length > 1 ? new Date(this.filterDates[1]) : new Date(this.filterDates[0]); end.setHours(23,59,59,999);
                    const taskDate = new Date(t.dateDelivered + 'T12:00:00');
                    mDate = taskDate >= start && taskDate <= end;
                }
            }
            return mAsig && mReq && mStat && mDate;
        });

        // REGLA DE ORDENAMIENTO DOBLE (Estrellas Arriba O(N log N))
        const sortTasks = (a, b) => {
            // Prioridad Primaria: Destacados
            if (a.isStarred && !b.isStarred) return -1;
            if (!a.isStarred && b.isStarred) return 1;
            
            // Prioridad Secundaria: Fechas de Entrega
            if (!a.dateDelivered && !b.dateDelivered) return 0;
            if (!a.dateDelivered) return 1; 
            if (!b.dateDelivered) return -1; 
            return (new Date(a.dateDelivered).getTime() - new Date(b.dateDelivered).getTime()) * sortModifier;
        };

        const activas = filtered.filter(t => t.status !== 'Entregado').sort(sortTasks);
        const completadas = filtered.filter(t => t.status === 'Entregado').sort(sortTasks);

        document.getElementById('countPrioridades').textContent = activas.length;
        document.getElementById('countRealizadas').textContent = completadas.length;

        this.renderWorkloadChart(activas);

        const myTasks = this.tasks.filter(t => t.status !== 'Entregado' && t.assignee === this.user.name).sort(sortTasks);
        
        myTasks.forEach(t => {
            const li = document.createElement('li');
            // Añadir clase de estrella para estilar en el CSS
            li.className = `request-item ${t.isStarred ? 'task-starred' : ''}`;
            li.tabIndex = 0; 
            li.id = `li-${t.id}`;
            
            // Prevent Event Bubbling
            const handleExpand = (e) => {
                if(e.target.closest('input, button')) return;
                document.querySelectorAll('.request-item.expanded').forEach(el => { if(el !== li) el.classList.remove('expanded'); });
                const exp = li.classList.toggle('expanded');
                document.querySelectorAll('.task-table tr').forEach(tr => tr.classList.remove('expanded-row'));
            };

            li.onclick = handleExpand;
            li.onkeydown = (e) => { if (e.key === 'Enter') handleExpand(e); };
            
            const colorHex = this.getColor(t.assignee);
            
            let dateClass = '';
            let dateAlertIcon = '';
            let overDueBadge = '';

            if (t.dateDelivered) {
                if (t.dateDelivered < todayStr) {
                    dateClass = 'text-danger';
                    dateAlertIcon = '<i data-lucide="alert-triangle" class="text-danger" style="width:14px;height:14px;margin-right:2px;"></i>';
                    overDueBadge = '<span class="time-alert-badge danger">¡Vencida!</span>';
                } else if (t.dateDelivered === todayStr) {
                    dateClass = 'text-warning';
                    dateAlertIcon = '<i data-lucide="clock" class="text-warning" style="width:14px;height:14px;margin-right:2px;"></i>';
                    overDueBadge = '<span class="time-alert-badge warning">Para Hoy</span>';
                }
            }
            
            li.innerHTML = `
                <div class="req-header">
                    <span class="req-name">
                        <button type="button" class="btn-star ${t.isStarred ? 'active' : ''}" onclick="App.toggleTaskStar('${t.id}')" aria-label="Destacar">
                            <i data-lucide="star" style="width: 14px; height: 14px;"></i>
                        </button>
                        <span class="req-name-text">${escapeHTML(t.name)}</span>
                    </span>
                    <div class="req-dates">
                        <span style="white-space: nowrap;">R: ${t.dateReceived ? t.dateReceived.split('-').reverse().join('/') : 'N/A'}</span>
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                            <span class="${dateClass}" style="display:flex; align-items:center; white-space:nowrap;">E: <strong style="display:inline-flex; align-items:center; margin-left:4px;">${dateAlertIcon}${t.dateDelivered ? t.dateDelivered.split('-').reverse().join('/') : 'Seleccionar'}</strong></span>
                            ${overDueBadge}
                        </div>
                    </div>
                </div>
                <div class="req-extra-info">
                    <div class="req-detail-row"><span>Solicitante:</span><strong>${escapeHTML(t.requester)}</strong></div>
                    <div class="req-detail-row"><span>A cargo:</span><span class="badge-count" style="color:${colorHex}; background-color:${colorHex}20; border: 1px solid ${colorHex}40;">${escapeHTML(t.assignee)}</span></div>
                </div>
            `;
            sList.appendChild(li);
        });
        if(myTasks.length === 0) sList.innerHTML = '<li class="request-item" style="color:var(--text-muted); text-align:center; padding: 20px 10px; border:none; box-shadow:none; cursor:default;">No tienes tareas asignadas</li>';

        let assigneeOpts = `<option value="No asignado">No asignado</option>` + this.members.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');
        
        activas.forEach(t => {
            const tr = document.createElement('tr');
            tr.id = `tr-${t.id}`;
            tr.className = t.isStarred ? 'task-starred' : ''; // Clase de Estrella Visual en la fila
            
            const colorHex = this.getColor(t.assignee);
            const isCurso = t.status === 'En curso';
            
            tr.addEventListener('click', (e) => {
                // Ignore clicks on buttons to prevent bubbling collision
                if (e.target.closest('select, input, button, .status-switch, .inline-date-picker, .custom-checkbox, .action-buttons, a, .btn-star')) {
                    return;
                }
                document.querySelectorAll('.task-table tr').forEach(r => {
                    if(r !== tr) r.classList.remove('expanded-row');
                });
                tr.classList.toggle('expanded-row');
            });
            
            let dateDeliveredVal = t.dateDelivered || '';
            let dateClass = '';
            if (t.dateDelivered) {
                if (t.dateDelivered < todayStr) dateClass = 'text-danger';
                else if (t.dateDelivered === todayStr) dateClass = 'text-warning';
            }
            
            tr.innerHTML = `
                <td style="text-align:center;" data-label="Completada"><input type="checkbox" class="custom-checkbox" aria-label="Marcar como entregado" onchange="App.updateTask('${t.id}', 'status', this.checked ? 'Entregado' : 'En curso', true)"></td>
                <td data-label="Solicitud">
                    <div class="req-title-cell">
                        <strong>
                            <button type="button" class="btn-star ${t.isStarred ? 'active' : ''}" onclick="App.toggleTaskStar('${t.id}')" aria-label="Destacar">
                                <i data-lucide="star"></i>
                            </button>
                            <span class="req-title-text">${escapeHTML(t.name)}</span>
                        </strong>
                        <span>${escapeHTML(t.requester)}</span>
                    </div>
                </td>
                <td data-label="Asignación">
                    <select class="native-select-hidden table-select inline-assignee" aria-label="Cambiar asignación" data-color="${colorHex}" onchange="App.updateTask('${t.id}', 'assignee', this.value, false)">
                        ${assigneeOpts.replace(`value="${t.assignee}"`, `value="${t.assignee}" selected`)}
                    </select>
                </td>
                <td class="date-info" data-label="Fechas (Rec - Ent)">
                    <span class="date-req">R: ${t.dateReceived ? t.dateReceived.split('-').reverse().join('/') : 'N/A'}</span>
                    <input type="text" class="inline-date-picker ${dateClass}" data-id="${t.id}" aria-label="Cambiar fecha de entrega" data-received="${t.dateReceived}" value="${dateDeliveredVal}" placeholder="Seleccionar">
                </td>
                <td data-label="Estado">
                    <div id="status-switch-${t.id}" 
                         class="status-switch ${isCurso ? 'curso' : 'cola'}" 
                         role="switch" 
                         aria-checked="${isCurso ? 'true' : 'false'}" 
                         tabindex="0"
                         onclick="App.toggleTaskStatus('${t.id}')"
                         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); App.toggleTaskStatus('${t.id}');}">
                        <div class="switch-track"><div class="switch-thumb"></div></div>
                        <span class="switch-label">${escapeHTML(t.status)}</span>
                    </div>
                </td>
                <td style="text-align:center;" data-label="Acciones">
                    <div class="action-buttons">
                        <button type="button" class="btn-icon edit" aria-label="Editar tarea" onclick="App.openEditModal('${t.id}')"><i data-lucide="edit-3"></i></button>
                        <button type="button" class="btn-icon delete" aria-label="Eliminar tarea" onclick="if(confirm('¿Eliminar?')) { App.tasks = App.tasks.filter(x => x.id !== '${t.id}'); App.markAsUnsaved(); App.renderBoard(); UI.showToast('Tarea eliminada', 'success'); }"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            `;
            tBody.appendChild(tr);
        });
        if(activas.length === 0) tBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">No hay tareas pendientes.</td></tr>';

        completadas.forEach(t => {
            const li = document.createElement('li');
            li.className = `request-item completed-item ${t.isStarred ? 'task-starred' : ''}`;
            li.innerHTML = `
                <div style="display:flex; gap:10px;">
                    <input type="checkbox" class="custom-checkbox" aria-label="Desmarcar como entregado" checked onchange="App.updateTask('${t.id}', 'status', this.checked ? 'Entregado' : 'En curso', true)">
                    <div style="width: 100%;">
                        <div class="req-name-text" style="text-decoration: line-through; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">
                            ${t.isStarred ? '<i data-lucide="star" style="width: 12px; height: 12px; color: #f59e0b; fill: #f59e0b; margin-right: 4px;"></i>' : ''}
                            ${escapeHTML(t.name)}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; font-weight:500;">Entregado: ${t.dateDelivered ? t.dateDelivered.split('-').reverse().join('/') : 'N/A'} | Por: ${escapeHTML(t.assignee)}</div>
                    </div>
                </div>
            `;
            sCompList.appendChild(li);
        });
        if(completadas.length === 0) sCompList.innerHTML = '<li class="request-item" style="color:var(--text-muted); text-align:center; padding: 20px 10px; border:none; box-shadow:none; cursor:default; background:transparent;">Sin historial</li>';

        buildCustomSelects(tBody);
        
        this.fpInstances = flatpickr(".inline-date-picker", {
            locale: "es",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            altInputClass: "inline-date-picker-alt",
            disableMobile: "true",
            appendTo: document.body,
            onChange: (selectedDates, dateStr, instance) => {
                if(selectedDates.length === 0) return;
                const id = instance.element.getAttribute('data-id');
                const dateReceived = instance.element.getAttribute('data-received');
                
                if (dateReceived && new Date(dateStr) < new Date(dateReceived)) {
                    UI.showToast("La fecha de entrega no puede ser anterior a la recepción.", "error");
                    const task = this.tasks.find(x => x.id === id);
                    const oldDate = task ? task.dateDelivered : '';
                    instance.setDate(oldDate);
                    return;
                }
                
                this.updateTask(id, 'dateDelivered', dateStr, false);
            }
        });

        lucide.createIcons();
    },

    renderWorkloadChart(activasTasks) {
        const wContainer = document.getElementById('workloadContainer');
        if (!wContainer) return;
        
        const workload = {};
        let maxTasks = 0;
        
        this.members.forEach(m => workload[m] = 0);
        workload['No asignado'] = 0;
        
        activasTasks.forEach(t => {
            const assignee = t.assignee || 'No asignado';
            if (workload[assignee] === undefined) workload[assignee] = 0;
            workload[assignee]++;
            if (workload[assignee] > maxTasks) maxTasks = workload[assignee];
        });

        wContainer.innerHTML = '';
        const sortedWorkload = Object.entries(workload).sort((a, b) => b[1] - a[1]);

        sortedWorkload.forEach(([name, count]) => {
            if(count === 0 && name === 'No asignado') return; 
            
            const percentage = maxTasks === 0 ? 0 : (count / maxTasks) * 100;
            const color = this.getColor(name);
            const safeName = escapeHTML(name);
            
            wContainer.innerHTML += `
                <div class="workload-item">
                    <div class="workload-header">
                        <span>${safeName}</span>
                        <span>${count}</span>
                    </div>
                    <div class="workload-bar-bg">
                        <div class="workload-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                    </div>
                </div>
            `;
        });

        if(sortedWorkload.length === 0 || maxTasks === 0) {
            wContainer.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">No hay tareas activas</p>';
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try { await App.init(); } 
    catch(e) { console.error("FATAL ERROR:", e); alert("Ocurrió un error. Por favor, limpia la caché del navegador."); }
});