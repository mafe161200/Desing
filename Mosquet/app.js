lucide.createIcons();

/* =========================================
   UTILITIES & UI CORE
   ========================================= */
const escapeHTML = (str) => {
    return str ? str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag)) : '';
};

// Configuración de Supabase (Pega aquí tus llaves de Project Settings -> API)
const SUPABASE_URL = ""; 
const SUPABASE_ANON_KEY = ""; 
let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch(e) {
        console.warn("Supabase no inicializado, fallback a LocalStorage.", e);
    }
}

// Clase estática para Feedback de Interfaz
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
        
        setTimeout(() => {
            if(toast.parentElement) toast.remove();
        }, 3200);
    }

    static updateConnectionStatus(isOnline) {
        const el = document.getElementById('connectionStatus');
        const txt = document.getElementById('statusText');
        if (!el || !txt) return;
        
        if (isOnline) {
            el.classList.add('online');
            txt.textContent = 'En línea (Nube)';
        } else {
            el.classList.remove('online');
            txt.textContent = 'Modo Local';
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
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) users = parsed;
            }
        } catch(e) {
            console.warn("Error leyendo db_users de localStorage", e);
        }

        let baseUsers = typeof INITIAL_USERS !== 'undefined' ? INITIAL_USERS : [];
        const allUsersMap = new Map();

        baseUsers.forEach(u => {
            allUsersMap.set(u.username, { ...u });
        }); 
        
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
        try {
            localStorage.setItem('db_users', JSON.stringify(users));
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                UI.showToast("Error: Memoria llena. La imagen es muy pesada.", "error");
                throw error;
            }
        }
    },
    
    getTasks: async () => {
        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from('tasks').select('*');
                if (!error && data) {
                    UI.updateConnectionStatus(true);
                    return data;
                }
            } catch(e) {
                console.warn("Fallo en Supabase, usando LocalStorage como respaldo", e);
            }
        }
        UI.updateConnectionStatus(false);
        try {
            return JSON.parse(localStorage.getItem('db_tasks')) || [];
        } catch(e) {
            console.error("Error parseando tareas", e);
            return [];
        }
    },

    saveTasks: async (tasks) => {
        localStorage.setItem('db_tasks', JSON.stringify(tasks));
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('tasks').upsert(tasks);
                if (error) console.error("Error sincronizando en Supabase", error);
            } catch(e) {
                console.error("Excepción en sincronización remota", e);
            }
        }
    },
    
    getMembers: async () => {
        try {
            return JSON.parse(localStorage.getItem('db_members')) || ['Camilo', 'David', 'Mafe'];
        } catch(e) {
            console.error("Error leyendo miembros", e);
            return [];
        }
    },
    saveMembers: async (m) => localStorage.setItem('db_members', JSON.stringify(m)),
    
    getRequesters: async () => {
        try {
            return JSON.parse(localStorage.getItem('db_reqs')) || ['Comunicaciones Internas', 'Comercial', 'Mkt Interno'];
        } catch (e) {
            console.error("Error leyendo solicitantes", e);
            return [];
        }
    },
    saveRequesters: async (r) => localStorage.setItem('db_reqs', JSON.stringify(r))
};

const AuthService = {
    login: async (username, password) => {
        const users = await DataService.getUsers();
        const userClean = escapeHTML(username.trim().toLowerCase());
        const passClean = password.trim(); 
        
        const match = users.find(u => 
            u && typeof u.username === 'string' &&
            u.username.toLowerCase() === userClean && 
            u.password === passClean
        );
        
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
        } catch (e) {
            localStorage.removeItem('auth_user');
            return null;
        }
    }
};

const initDemoData = async () => {
    if (!localStorage.getItem('dh_first_load')) {
        const tasks = await DataService.getTasks();
        if (tasks.length === 0) {
            await DataService.saveTasks([
                {id: "1", name: "Rediseño Logo Corporativo", requester: "Comercial", assignee: "Camilo", status: "En curso", dateReceived: "2026-08-20", dateDelivered: "2026-08-30"},
                {id: "2", name: "Carrusel Instagram", requester: "Comunicaciones Internas", assignee: "David", status: "Entregado", dateReceived: "2026-08-15", dateDelivered: "2026-08-22"}
            ]);
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
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(e);
                }
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
                    optionsDiv.style.top = 'auto';
                    optionsDiv.style.bottom = 'calc(100% + 6px)';
                } else {
                    optionsDiv.style.top = 'calc(100% + 6px)';
                    optionsDiv.style.bottom = 'auto';
                }
                optionsDiv.classList.add('open'); 
                trigger.classList.add('active'); 
                
                const firstOpt = optionsDiv.querySelector('.select-option');
                if (firstOpt) firstOpt.focus();
            }
        };

        trigger.addEventListener('click', toggleDropdown);
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDropdown(e);
            }
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
                if (await AuthService.login(user, pass)) {
                    window.location.reload();
                } else {
                    document.getElementById('loginError').style.display = 'block';
                }
            } catch (err) {
                console.error("Login error:", err);
                UI.showToast("Error al iniciar sesión. Limpiando almacenamiento...", "error");
                localStorage.clear();
                setTimeout(() => window.location.reload(), 1500);
            }
        });
    },

    setupCrossTabSync() {
        window.addEventListener('storage', async (e) => {
            if (e.key && e.key.startsWith('db_')) {
                await this.loadData();
                this.renderAll();
            }
        });
    },

    setupRealtimeSubscription() {
        if (supabaseClient) {
            supabaseClient
                .channel('public:tasks')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async () => {
                    UI.showToast("Actualización en tiempo real recibida", "info");
                    await this.loadData();
                    this.renderAll();
                })
                .subscribe();
        }
    },

    updateAvatarUI() {
        const avatarEl = document.getElementById('userAvatar');
        const previewEl = document.getElementById('previewAvatar');
        
        let avatarUrl = this.user.avatar;
        if (!avatarUrl) {
            const themeColor = (this.user.theme || '#4f46e5').replace('#', '');
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.name)}&background=${themeColor}20&color=${themeColor}&font-size=0.33&bold=true`;
        }
        
        if(avatarEl) avatarEl.src = avatarUrl;
        if(previewEl) previewEl.src = avatarUrl;
    },

    async loadData() {
        this.originalTasks = await DataService.getTasks();
        this.tasks = JSON.parse(JSON.stringify(this.originalTasks));
        
        this.members = await DataService.getMembers();
        this.requesters = await DataService.getRequesters();
        this.usersList = await DataService.getUsers();
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
        document.getElementById('btnNewTask').addEventListener('click', () => mTask.classList.add('active'));
        
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
            if(fpInput && fpInput._flatpickr) {
                fpInput._flatpickr.clear();
            }

            this.renderBoard();
            buildCustomSelects(document.querySelector('.inline-filters-bar')); 
            UI.showToast("Filtros limpiados", "info");
        });

        // Formulario Creador
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const dateReceivedAuto = `${yyyy}-${mm}-${dd}`;
            
            const dateDelivered = escapeHTML(document.getElementById('dateDelivered').value);
            
            if (dateDelivered && new Date(dateDelivered) < new Date(dateReceivedAuto)) {
                UI.showToast("La fecha de entrega no puede ser en el pasado.", "error"); 
                return;
            }

            this.tasks.push({
                id: Date.now().toString(),
                name: escapeHTML(document.getElementById('taskName').value),
                requester: escapeHTML(document.getElementById('requesterSelect').value),
                assignee: escapeHTML(document.getElementById('assignee').value),
                status: escapeHTML(document.getElementById('status').value),
                dateReceived: dateReceivedAuto, 
                dateDelivered: dateDelivered
            });
            
            this.markAsUnsaved(); 
            e.target.reset();
            document.getElementById('modalTask').classList.remove('active');
            UI.showToast("Solicitud añadida (Recuerda guardar cambios)", "success");
            this.renderBoard();
        });

        // Formulario Editor
        document.getElementById('editTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('editTaskId').value;
            const task = this.tasks.find(t => t.id === id);
            
            if (task) {
                task.name = escapeHTML(document.getElementById('editTaskName').value);
                task.requester = escapeHTML(document.getElementById('editRequesterSelect').value);
                
                this.markAsUnsaved();
                document.getElementById('modalEditTask').classList.remove('active');
                UI.showToast("Solicitud editada", "success");
                this.renderBoard();
            }
        });
    },

    openEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskName').value = task.name;
        
        const reqSelect = document.getElementById('editRequesterSelect');
        updateCustomSelectUI(reqSelect, task.requester);

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

        swatches.forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                swatches.forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                selectedTheme = escapeHTML(e.target.getAttribute('data-color'));
            });
            swatch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    swatches.forEach(s => s.classList.remove('active'));
                    e.target.classList.add('active');
                    selectedTheme = escapeHTML(e.target.getAttribute('data-color'));
                }
            });
        });

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
                } catch (e) {
                    return; 
                }
            }

            this.usersList = await DataService.getUsers();
            this.updateAvatarUI();
            resetProfileModal();
            mProfile.classList.remove('active');
            this.renderAll(); 
        };

        document.getElementById('userProfileBtn').addEventListener('click', () => {
            resetProfileModal();
            urlInput.value = this.user.avatar && this.user.avatar.startsWith('http') ? this.user.avatar : '';
            
            selectedTheme = this.user.theme || '#4f46e5';
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
            if (confirm('¿Seguro que deseas eliminar tu foto y volver a tus iniciales?')) {
                saveAndClose("");
            }
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

                    if (this.cropperInstance) {
                        this.cropperInstance.destroy();
                    }
                    this.cropperInstance = new Cropper(cropperImage, {
                        aspectRatio: 1,
                        viewMode: 1,
                        background: false,
                        autoCropArea: 1,
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
                await DataService.saveMembers(this.members);
                
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
            const name = escapeHTML(input.value.trim());
            if (name && !this.requesters.some(r => r.toLowerCase() === name.toLowerCase())) {
                this.requesters.push(name); 
                await DataService.saveRequesters(this.requesters);
                input.value = ''; 
                this.renderAll();
                UI.showToast("Solicitante añadido", "success");
            }
        });
        
        window.removeRequester = async (index) => { 
            if (confirm('¿Eliminar solicitante?')) { 
                this.requesters.splice(index, 1); 
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
        
        if (dbUser && dbUser.theme) {
            return dbUser.theme;
        }

        const allColors = ['#4f46e5', '#2563eb', '#0284c7', '#0891b2', '#0d9488', '#059669', '#16a34a', '#84cc16', '#f59e0b', '#ea580c', '#dc2626', '#e11d48', '#db2777', '#c026d3', '#7c3aed'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return allColors[Math.abs(hash) % allColors.length];
    },

    updateTask(id, field, value, shouldRender = false) {
        const t = this.tasks.find(x => x.id === id);
        if (t) {
            t[field] = escapeHTML(value);
            this.markAsUnsaved(); 
            this.renderWorkloadChart(this.tasks.filter(x => x.status !== 'Entregado'));
            if(shouldRender) this.renderBoard(); 
        }
    },

    renderBoard() {
        const sList = document.getElementById('sidebarList');
        const sCompList = document.getElementById('sidebarCompletedList');
        const tBody = document.getElementById('tablePrioridades');
        
        if (this.fpInstances) {
            const instances = Array.isArray(this.fpInstances) ? this.fpInstances : [this.fpInstances];
            instances.forEach(fp => {
                if (fp && typeof fp.destroy === 'function') fp.destroy();
            });
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

        const sortTasks = (a, b) => {
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
            li.className = 'request-item';
            li.tabIndex = 0; 
            
            const handleExpand = (e) => {
                if(e.target.tagName.toLowerCase() === 'input') return;
                document.querySelectorAll('.request-item.expanded').forEach(el => { if(el !== li) el.classList.remove('expanded'); });
                const exp = li.classList.toggle('expanded');
                document.querySelectorAll('.task-table tr').forEach(tr => tr.classList.remove('row-highlight'));
                if(exp) {
                    const row = document.getElementById(`tr-${t.id}`);
                    if(row) { row.classList.add('row-highlight'); row.scrollIntoView({behavior:'smooth', block:'center'}); }
                }
            };

            li.onclick = handleExpand;
            li.onkeydown = (e) => { if (e.key === 'Enter') handleExpand(e); };
            
            const colorHex = this.getColor(t.assignee);
            
            li.innerHTML = `
                <div class="req-header">
                    <span class="req-name"><span class="req-status-dot dot-${t.status === 'En curso' ? 'curso' : 'cola'}"></span>${escapeHTML(t.name)}</span>
                    <div class="req-dates">
                        <span>R: ${t.dateReceived ? t.dateReceived.split('-').reverse().join('/') : 'N/A'}</span>
                        <span>E: <strong>${t.dateDelivered ? t.dateDelivered.split('-').reverse().join('/') : 'Seleccionar'}</strong></span>
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
            const colorHex = this.getColor(t.assignee);
            const isCurso = t.status === 'En curso';
            
            let dateDeliveredVal = t.dateDelivered || '';
            
            tr.innerHTML = `
                <td style="text-align:center;" data-label="Completada"><input type="checkbox" class="custom-checkbox" aria-label="Marcar como entregado" onchange="App.updateTask('${t.id}', 'status', this.checked ? 'Entregado' : 'En curso', true)"></td>
                <td data-label="Solicitud">
                    <div class="req-title-cell">
                        <strong>${escapeHTML(t.name)}</strong>
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
                    <input type="text" class="inline-date-picker" data-id="${t.id}" aria-label="Cambiar fecha de entrega" data-received="${t.dateReceived}" value="${dateDeliveredVal}" placeholder="Seleccionar">
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
            li.className = 'request-item completed-item';
            li.innerHTML = `
                <div style="display:flex; gap:10px;">
                    <input type="checkbox" class="custom-checkbox" aria-label="Desmarcar como entregado" checked onchange="App.updateTask('${t.id}', 'status', this.checked ? 'Entregado' : 'En curso', true)">
                    <div style="width: 100%;">
                        <div class="req-name">${escapeHTML(t.name)}</div>
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
                    UI.showToast("La fecha de entrega no puede ser anterior a la de recepción.", "error");
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

document.addEventListener('DOMContentLoaded', () => App.init());
