lucide.createIcons();

/* =========================================
   CAPA DE SERVICIOS (BACKEND Y AUTH)
   ========================================= */
const DataService = {
    getUsers: () => {
        let users = [];
        try {
            const data = localStorage.getItem('db_users');
            if (data) users = JSON.parse(data);
        } catch(e) {
            console.error("Error leyendo caché de usuarios", e);
        }

        let baseUsers = typeof INITIAL_USERS !== 'undefined' ? INITIAL_USERS : [
            { username: "admin", password: "Admin_DH2026!", role: "admin", name: "Administrador General", avatar: "", theme: "#4f46e5" },
            { username: "camilo", password: "Camilo_DH2026!", role: "editor", name: "Camilo", avatar: "", theme: "#db2777" },
            { username: "david", password: "David_DH2026!", role: "editor", name: "David", avatar: "", theme: "#ea580c" },
            { username: "mafe", password: "Mafe_DH2026!", role: "editor", name: "Mafe", avatar: "", theme: "#0284c7" }
        ];

        const allUsersMap = new Map();
        baseUsers.forEach(u => allUsersMap.set(u.username, u)); 
        users.forEach(u => {
            if(allUsersMap.has(u.username)) {
                let existing = allUsersMap.get(u.username);
                existing.avatar = u.avatar || existing.avatar;
                existing.theme = u.theme || existing.theme || '#2563eb';
                allUsersMap.set(u.username, existing);
            } else {
                allUsersMap.set(u.username, u);
            }
        });

        const finalUsers = Array.from(allUsersMap.values());
        localStorage.setItem('db_users', JSON.stringify(finalUsers));
        
        return finalUsers;
    },
    saveUsers: (users) => localStorage.setItem('db_users', JSON.stringify(users)),
    
    getTasks: () => JSON.parse(localStorage.getItem('db_tasks')) || [],
    saveTasks: (tasks) => localStorage.setItem('db_tasks', JSON.stringify(tasks)),
    
    getMembers: () => JSON.parse(localStorage.getItem('db_members')) || ['Camilo', 'David', 'Mafe'],
    saveMembers: (m) => localStorage.setItem('db_members', JSON.stringify(m)),
    
    getRequesters: () => JSON.parse(localStorage.getItem('db_reqs')) || ['Comunicaciones Internas', 'Comercial', 'Mkt Interno'],
    saveRequesters: (r) => localStorage.setItem('db_reqs', JSON.stringify(r))
};

const AuthService = {
    login: (username, password) => {
        const users = DataService.getUsers();
        const userClean = username.trim().toLowerCase();
        const passClean = password.trim(); 
        
        const match = users.find(u => u.username.toLowerCase() === userClean && u.password === passClean);
        
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
    getUser: () => JSON.parse(localStorage.getItem('auth_user'))
};

if (!localStorage.getItem('dh_first_load')) {
    if (DataService.getTasks().length === 0) {
        DataService.saveTasks([
            {id: "1", name: "Rediseño Logo Corporativo", requester: "Comercial", assignee: "Camilo", status: "En curso", dateReceived: "2026-08-20", dateDelivered: "2026-08-30"},
            {id: "2", name: "Carrusel Instagram", requester: "Comunicaciones Internas", assignee: "David", status: "Entregado", dateReceived: "2026-08-15", dateDelivered: "2026-08-22"}
        ]);
    }
    localStorage.setItem('dh_first_load', '1');
}

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
        const classNames = Array.from(select.classList).filter(c => c !== 'native-select-hidden').join(' ');
        trigger.className = `select-trigger ${classNames}`;
        trigger.innerHTML = `<span>${select.options[select.selectedIndex]?.text || ''}</span> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        
        const color = select.getAttribute('data-color');
        if (color && color !== '#94a3b8') {
            trigger.style.color = color;
            trigger.style.backgroundColor = color + '20';
            trigger.style.borderColor = color + '40';
        } else if (color === '#94a3b8') {
            trigger.style.color = 'var(--text-muted)';
            trigger.style.backgroundColor = '#f1f5f9';
            trigger.style.borderColor = '#e2e8f0';
        }

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'select-options';

        Array.from(select.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = `select-option ${opt.selected ? 'selected' : ''}`;
            item.textContent = opt.text;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = opt.value;
                trigger.querySelector('span').textContent = opt.text;
                select.dispatchEvent(new Event('change'));
                
                optionsDiv.classList.remove('open');
                trigger.classList.remove('active');
                Array.from(optionsDiv.children).forEach(c => c.classList.remove('selected'));
                item.classList.add('selected');
            });
            optionsDiv.appendChild(item);
        });

        trigger.addEventListener('click', (e) => {
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
            }
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsDiv);
    });
    lucide.createIcons();
}

document.addEventListener('click', () => {
    document.querySelectorAll('.select-options').forEach(o => o.classList.remove('open'));
    document.querySelectorAll('.select-trigger').forEach(t => t.classList.remove('active'));
});

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
    saveTimeout: null, 
    hasUnsavedChanges: false,
    cropperInstance: null,

    init() {
        this.user = AuthService.getUser();
        
        if (!this.user) {
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

            document.getElementById('loginForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const user = document.getElementById('usernameInput').value;
                const pass = document.getElementById('passwordInput').value;
                
                if (AuthService.login(user, pass)) {
                    window.location.reload();
                } else {
                    document.getElementById('loginError').style.display = 'block';
                }
            });
            return; 
        }

        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('currentUserName').textContent = this.user.name;
        document.getElementById('btnLogout').addEventListener('click', AuthService.logout);

        this.updateAvatarUI();

        if (this.user.role === 'editor') {
            document.querySelectorAll('.admin-only').forEach(el => el.remove());
        }

        this.loadData();
        this.setupPlugins();
        this.setupEventListeners();
        this.renderAll();
    },

    updateAvatarUI() {
        const avatarEl = document.getElementById('userAvatar');
        const previewEl = document.getElementById('previewAvatar');
        
        let avatarUrl = this.user.avatar;
        if (!avatarUrl) {
            const themeColor = (this.user.theme || '#2563eb').replace('#', '');
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.name)}&background=${themeColor}20&color=${themeColor}&font-size=0.33&bold=true`;
        }
        
        if(avatarEl) avatarEl.src = avatarUrl;
        if(previewEl) previewEl.src = avatarUrl;
    },

    loadData() {
        this.originalTasks = DataService.getTasks();
        this.tasks = JSON.parse(JSON.stringify(this.originalTasks));
        
        this.members = DataService.getMembers();
        this.requesters = DataService.getRequesters();
        this.usersList = DataService.getUsers();
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
        document.getElementById('draftActions').style.display = 'flex';
    },

    saveChanges() {
        DataService.saveTasks(this.tasks);
        this.originalTasks = JSON.parse(JSON.stringify(this.tasks));
        this.hasUnsavedChanges = false;
        document.getElementById('draftActions').style.display = 'none';
        this.renderBoard(); 
    },

    undoChanges() {
        this.tasks = JSON.parse(JSON.stringify(this.originalTasks));
        this.hasUnsavedChanges = false;
        document.getElementById('draftActions').style.display = 'none';
        this.renderBoard();
    },

    setupEventListeners() {
        document.getElementById('btnSave').addEventListener('click', () => this.saveChanges());
        document.getElementById('btnUndo').addEventListener('click', () => this.undoChanges());

        const mTask = document.getElementById('modalTask');
        document.getElementById('btnNewTask').addEventListener('click', () => mTask.classList.add('active'));
        
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

        let selectedTheme = this.user.theme || '#2563eb';

        swatches.forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                swatches.forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                selectedTheme = e.target.getAttribute('data-color');
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

        const saveAndClose = (avatarData) => {
            this.user.avatar = avatarData;
            this.user.theme = selectedTheme;
            localStorage.setItem('auth_user', JSON.stringify(this.user));
            
            let allUsers = DataService.getUsers();
            let dbUser = allUsers.find(u => u.username === this.user.username);
            if(dbUser) {
                dbUser.avatar = avatarData;
                dbUser.theme = selectedTheme;
                DataService.saveUsers(allUsers);
            }

            this.usersList = DataService.getUsers();
            this.updateAvatarUI();
            resetProfileModal();
            mProfile.classList.remove('active');
            this.renderAll(); 
        };

        document.getElementById('userProfileBtn').addEventListener('click', () => {
            resetProfileModal();
            urlInput.value = this.user.avatar && this.user.avatar.startsWith('http') ? this.user.avatar : '';
            
            selectedTheme = this.user.theme || '#2563eb';
            swatches.forEach(s => s.classList.remove('active'));
            const activeSwatch = document.querySelector(`.color-swatch[data-color="${selectedTheme}"]`);
            if(activeSwatch) activeSwatch.classList.add('active');

            mProfile.classList.add('active');
        });

        document.getElementById('closeProfileModalBtn').addEventListener('click', () => {
            resetProfileModal();
            mProfile.classList.remove('active');
        });

        btnCancelCrop.addEventListener('click', () => {
            resetProfileModal();
        });

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
                saveAndClose(canvas.toDataURL('image/webp', 0.9));
            } else if (urlInput.value.trim() !== '') {
                saveAndClose(urlInput.value.trim());
            } else {
                saveAndClose(this.user.avatar || ""); 
            }
        });
        
        if (this.user.role === 'admin') {
            document.getElementById('btnManageTeam').addEventListener('click', () => document.getElementById('modalTeam').classList.add('active'));
            document.getElementById('btnManageReq').addEventListener('click', () => document.getElementById('modalRequesters').classList.add('active'));
            
            document.getElementById('addMemberBtn').addEventListener('click', (e) => {
                e.preventDefault();
                const input = document.getElementById('newMemberInput');
                const name = input.value.trim();
                if (name && !this.members.some(m => m.toLowerCase() === name.toLowerCase())) {
                    this.members.push(name); 
                    DataService.saveMembers(this.members);
                    
                    const themeOptions = ['#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#e11d48', '#dc2626', '#ea580c', '#b45309', '#059669', '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#475569'];
                    const randomTheme = themeOptions[Math.floor(Math.random() * themeOptions.length)];

                    let dbUsers = DataService.getUsers();
                    if (!dbUsers.some(u => u.username === name.toLowerCase())) {
                        dbUsers.push({ username: name.toLowerCase(), password: `${name}_DH2026!`, role: "editor", name: name, avatar: "", theme: randomTheme });
                        DataService.saveUsers(dbUsers);
                    }

                    this.usersList = DataService.getUsers();
                    input.value = ''; this.renderAll();
                }
            });
            window.removeMember = (index) => { 
                if (confirm('¿Quitar del equipo?')) { 
                    const removedName = this.members[index];
                    this.members.splice(index, 1); 
                    DataService.saveMembers(this.members); 

                    let dbUsers = DataService.getUsers();
                    dbUsers = dbUsers.filter(u => u.username.toLowerCase() !== removedName.toLowerCase());
                    DataService.saveUsers(dbUsers);

                    this.usersList = DataService.getUsers();
                    this.renderAll(); 
                } 
            };

            document.getElementById('addRequesterBtn').addEventListener('click', (e) => {
                e.preventDefault();
                const input = document.getElementById('newRequesterInput');
                const name = input.value.trim();
                if (name && !this.requesters.some(r => r.toLowerCase() === name.toLowerCase())) {
                    this.requesters.push(name); DataService.saveRequesters(this.requesters);
                    input.value = ''; this.renderAll();
                }
            });
            window.removeRequester = (index) => { if (confirm('¿Eliminar solicitante?')) { this.requesters.splice(index, 1); DataService.saveRequesters(this.requesters); this.renderAll(); } };
        }

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
        });

        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const dateReceivedAuto = `${yyyy}-${mm}-${dd}`;
            
            const dateDelivered = document.getElementById('dateDelivered').value;
            
            if (dateDelivered && new Date(dateDelivered) < new Date(dateReceivedAuto)) {
                alert("La fecha de entrega no puede ser en el pasado."); 
                return;
            }

            this.tasks.push({
                id: Date.now().toString(),
                name: document.getElementById('taskName').value,
                requester: document.getElementById('requesterSelect').value,
                assignee: document.getElementById('assignee').value,
                status: document.getElementById('status').value,
                dateReceived: dateReceivedAuto, 
                dateDelivered: dateDelivered
            });
            
            this.markAsUnsaved(); 
            e.target.reset();
            document.getElementById('modalTask').classList.remove('active');
            this.renderBoard();
        });
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
            this.members.forEach(m => el.innerHTML += `<option value="${m}">${m}</option>`);
        });

        const sReq = ['requesterSelect', 'filterRequester'];
        sReq.forEach(id => {
            const el = document.getElementById(id);
            if(!el) return;
            el.innerHTML = id === 'filterRequester' ? '<option value="Todos">Solicitante: Todos</option>' : '';
            this.requesters.forEach(r => el.innerHTML += `<option value="${r}">${r}</option>`);
        });
        buildCustomSelects(document.querySelector('.inline-filters-bar'));
        buildCustomSelects(document.querySelector('.task-form'));
    },

    renderTags() {
        if(this.user.role !== 'admin') return;
        
        const mList = document.getElementById('membersList');
        mList.innerHTML = '';
        this.members.forEach((m) => {
            const hexColor = this.getColor(m);
            mList.innerHTML += `<div class="member-chip" style="color: ${hexColor}; background-color: ${hexColor}20; border-color: ${hexColor}40;"><span>${m}</span><button class="remove-member" onclick="removeMember('${this.members.indexOf(m)}')"><i data-lucide="x"></i></button></div>`;
        });

        const rList = document.getElementById('requestersList');
        rList.innerHTML = '';
        this.requesters.forEach((r, i) => {
            rList.innerHTML += `<div class="member-chip"><span>${r}</span><button class="remove-member" onclick="removeRequester(${i})"><i data-lucide="x"></i></button></div>`;
        });
        lucide.createIcons();
    },

    getColor(name) {
        if (name === 'No asignado' || !name) return '#94a3b8';
        
        if (name.toLowerCase() === this.user.name.toLowerCase()) {
            return this.user.theme || '#2563eb';
        }

        const myColor = this.user.theme || '#2563eb';
        const allColors = ['#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#e11d48', '#dc2626', '#ea580c', '#b45309', '#059669', '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#475569'];
        
        const availableColors = allColors.filter(c => c !== myColor);
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return availableColors[Math.abs(hash) % availableColors.length];
    },

    updateTask(id, field, value, shouldRender = true) {
        const t = this.tasks.find(x => x.id === id);
        if (t) {
            t[field] = value;
            this.markAsUnsaved(); 
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

        const myTasks = this.tasks.filter(t => t.status !== 'Entregado' && t.assignee === this.user.name).sort(sortTasks);
        
        myTasks.forEach(t => {
            const li = document.createElement('li');
            li.className = 'request-item';
            li.onclick = (e) => {
                if(e.target.tagName.toLowerCase() === 'input') return;
                document.querySelectorAll('.request-item.expanded').forEach(el => { if(el !== li) el.classList.remove('expanded'); });
                const exp = li.classList.toggle('expanded');
                document.querySelectorAll('.task-table tr').forEach(tr => tr.classList.remove('row-highlight'));
                if(exp) {
                    const row = document.getElementById(`tr-${t.id}`);
                    if(row) { row.classList.add('row-highlight'); row.scrollIntoView({behavior:'smooth', block:'center'}); }
                }
            };
            
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

        let assigneeOpts = `<option value="No asignado">No asignado</option>` + this.members.map(m => `<option value="${m}">${m}</option>`).join('');
        
        activas.forEach(t => {
            const tr = document.createElement('tr');
            tr.id = `tr-${t.id}`;
            const colorHex = this.getColor(t.assignee);
            
            let dateDeliveredVal = t.dateDelivered || '';
            
            tr.innerHTML = `
                <td style="text-align:center;"><input type="checkbox" class="custom-checkbox" onchange="App.updateTask('${t.id}', 'status', this.checked ? 'Entregado' : 'En curso')"></td>
                <td>
                    <div class="req-title-cell">
                        <strong>${escapeHTML(t.name)}</strong>
                        <span>${escapeHTML(t.requester)}</span>
                    </div>
                </td>
                <td>
                    <select class="native-select-hidden table-select inline-assignee" data-color="${colorHex}" onchange="App.updateTask('${t.id}', 'assignee', this.value)">
                        ${assigneeOpts.replace(`value="${t.assignee}"`, `value="${t.assignee}" selected`)}
                    </select>
                </td>
                <td class="date-info">
                    <span class="date-req">R: ${t.dateReceived ? t.dateReceived.split('-').reverse().join('/') : 'N/A'}</span>
                    <input type="text" class="inline-date-picker" data-id="${t.id}" data-received="${t.dateReceived}" value="${dateDeliveredVal}" placeholder="Seleccionar">
                </td>
                <td>
                    <select class="native-select-hidden table-select status-select ${t.status === 'En curso' ? 'curso' : 'cola'}" onchange="App.updateTask('${t.id}', 'status', this.value)">
                        <option value="En cola" ${t.status === 'En cola' ? 'selected' : ''}>En cola</option>
                        <option value="En curso" ${t.status === 'En curso' ? 'selected' : ''}>En curso</option>
                    </select>
                </td>
                <td style="text-align:center;"><button class="btn-icon" onclick="if(confirm('¿Eliminar?')) { App.tasks = App.tasks.filter(x => x.id !== '${t.id}'); App.markAsUnsaved(); App.renderBoard(); }"><i data-lucide="trash-2"></i></button></td>
            `;
            tBody.appendChild(tr);
        });
        if(activas.length === 0) tBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">No hay tareas pendientes.</td></tr>';

        completadas.forEach(t => {
            const li = document.createElement('li');
            li.className = 'request-item completed-item';
            li.innerHTML = `
                <div style="display:flex; gap:10px;">
                    <input type="checkbox" class="custom-checkbox" checked onchange="App.updateTask('${t.id}', 'status', this.checked ? 'Entregado' : 'En curso')">
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
                    alert("La fecha de entrega no puede ser anterior a la de recepción.");
                    const task = this.tasks.find(x => x.id === id);
                    const oldDate = task ? task.dateDelivered : '';
                    instance.setDate(oldDate);
                    return;
                }
                
                this.updateTask(id, 'dateDelivered', dateStr, false);
            }
        });

        lucide.createIcons();
    }
};

function escapeHTML(str) { return str ? str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag)) : ''; }

document.addEventListener('DOMContentLoaded', () => App.init());