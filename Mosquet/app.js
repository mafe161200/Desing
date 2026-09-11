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
    supabasePublishableKey: "sb_publishable_6tEj9AVvkEbGzlfZMAeW_w_yE0nVnSU"
});

const LEGACY_LOCAL_STORAGE_KEYS = Object.freeze([
    'db_tasks',
    'db_notes',
    'db_members',
    'db_reqs',
    'dh_first_load'
]);

const clearLegacyLocalData = () => {
    try {
        LEGACY_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
        console.warn('No fue posible limpiar datos locales heredados.', error);
    }
};

const normalizeText = (value) => String(value ?? '').trim();

const getInitials = (value) => {
    const parts = normalizeText(value)
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const normalizeUsername = (value) => normalizeText(value).toLowerCase();

const createId = () => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

const sanitizeThemeColor = (value, fallback = '#4f46e5') => {
    const color = normalizeText(value);
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
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
    static showToast(message, type = 'info', duration = 8000, onClickCallback = null, persistent = false) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}${persistent ? ' toast-persistent' : ''}`;

        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'alert-circle';
        if (type === 'warning') icon = 'alert-triangle';

        const iconEl = document.createElement('i');
        iconEl.setAttribute('data-lucide', icon);
        iconEl.setAttribute('aria-hidden', 'true');

        const content = document.createElement('span');
        content.className = 'toast-message';
        content.textContent = message;

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'toast-close';
        closeButton.setAttribute('aria-label', 'Cerrar notificación');
        closeButton.title = 'Cerrar';
        closeButton.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';

        closeButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 250);
        });

        toast.appendChild(iconEl);
        toast.appendChild(content);
        toast.appendChild(closeButton);

        if (onClickCallback) {
            toast.classList.add('toast-clickable');
            toast.title = 'Haz clic para ir a la tarea';
            toast.addEventListener('click', (event) => {
                if (event.target.closest('.toast-close')) return;
                onClickCallback();
            });
        }

        container.appendChild(toast);
        lucide.createIcons();

        if (!persistent) {
            setTimeout(() => {
                if (!toast.parentElement) return;
                toast.classList.add('fade-out');
                setTimeout(() => {
                    if (toast.parentElement) toast.remove();
                }, 250);
            }, duration);
        }
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
                 setTimeout(() => UI.showToast(`¡Tienes una tarea vencida!: ${nearest.name}`, 'error', 8000, callback, true), 1000);
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
        if (!supabaseClient) {
            console.error('Supabase no está disponible. No se cargarán perfiles locales.');
            return [];
        }

        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id, username, email, name, role, avatar, theme, created_at')
                .order('username', { ascending: true });

            if (error) {
                console.error('Supabase: no se pudieron cargar los perfiles.', error);
                UI.showToast('No se pudieron cargar los perfiles del equipo.', 'error');
                return [];
            }

            return (data || []).map(profile => ({
                id: profile.id,
                username: normalizeUsername(profile.username),
                email: normalizeText(profile.email),
                name: normalizeText(profile.name),
                role: profile.role === 'admin' ? 'admin' : 'editor',
                avatar: sanitizeAvatarUrl(profile.avatar),
                theme: sanitizeThemeColor(profile.theme),
                created_at: profile.created_at
            }));
        } catch (error) {
            console.error('Supabase: error cargando perfiles.', error);
            UI.showToast('No se pudieron cargar los perfiles del equipo.', 'error');
            return [];
        }
    },

    async getProfileByAuthId(authId) {
        if (!supabaseClient || !authId) return null;

        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id, username, email, name, role, avatar, theme, created_at')
                .eq('id', authId)
                .maybeSingle();

            if (error) {
                console.error('Supabase: no se pudo cargar el perfil.', error);
                return null;
            }

            if (!data) return null;

            return {
                id: data.id,
                username: normalizeUsername(data.username),
                email: normalizeText(data.email),
                name: normalizeText(data.name),
                role: data.role === 'admin' ? 'admin' : 'editor',
                avatar: sanitizeAvatarUrl(data.avatar),
                theme: sanitizeThemeColor(data.theme),
                created_at: data.created_at
            };
        } catch (error) {
            console.error('Supabase: error cargando el perfil.', error);
            return null;
        }
    },

    async updateProfile(authId, changes) {
        if (!supabaseClient || !authId) return false;

        const payload = {
            avatar: sanitizeAvatarUrl(changes?.avatar),
            theme: sanitizeThemeColor(changes?.theme)
        };

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update(payload)
                .eq('id', authId);

            if (error) {
                console.error('Supabase: no se pudo actualizar el perfil.', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Supabase: error actualizando el perfil.', error);
            return false;
        }
    },

    async getTasks() {
        if (!supabaseClient) {
            UI.updateConnectionStatus(false);
            return [];
        }

        try {
            const { data, error } = await supabaseClient
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) {
                UI.updateConnectionStatus(false, error.message);
                console.error('Supabase: no se pudieron cargar las tareas.', error);
                return [];
            }

            UI.updateConnectionStatus(true);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            UI.updateConnectionStatus(false, error.message);
            console.error('Supabase: error cargando tareas.', error);
            return [];
        }
    },

    async saveTasks(tasks, originalTasks = []) {
        if (!supabaseClient) {
            UI.updateConnectionStatus(false, 'Supabase no está disponible.');
            return { cloudSaved: false, error: new Error('Supabase no está disponible.') };
        }

        const safeTasks = Array.isArray(tasks) ? tasks : [];
        const safeOriginal = Array.isArray(originalTasks) ? originalTasks : [];
        const byId = new Map(safeOriginal.map(task => [String(task.id), task]));
        const currentIds = new Set(safeTasks.map(task => String(task.id)));

        const fields = ['name', 'requester', 'assignee', 'status', 'dateReceived', 'dateDelivered', 'isStarred', 'notes'];
        const buildPayload = (task) => {
            const payload = { id: task.id };
            fields.forEach(field => {
                payload[field] = task[field] ?? (field === 'isStarred' ? false : '');
            });
            return payload;
        };

        try {
            const inserted = safeTasks.filter(task => !byId.has(String(task.id)));
            const updated = safeTasks.filter(task => {
                const oldTask = byId.get(String(task.id));
                if (!oldTask) return false;
                return fields.some(field => String(task[field] ?? '') !== String(oldTask[field] ?? ''));
            });
            const deleted = safeOriginal.filter(task => !currentIds.has(String(task.id)));

            if (inserted.length) {
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .insert(inserted.map(buildPayload))
                    .select('id');
                if (error) throw error;
                if (!data || data.length !== inserted.length) {
                    throw new Error('Supabase no confirmó todas las tareas nuevas.');
                }
            }

            for (const task of updated) {
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .update(buildPayload(task))
                    .eq('id', task.id)
                    .select('id');
                if (error) throw error;
                if (!data || data.length !== 1) {
                    throw new Error(`Supabase no confirmó la actualización de la tarea ${task.id}.`);
                }
            }

            for (const task of deleted) {
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .delete()
                    .eq('id', task.id)
                    .select('id');
                if (error) throw error;
                if (!data || data.length !== 1) {
                    throw new Error(`Supabase no confirmó la eliminación de la tarea ${task.id}.`);
                }
            }

            UI.updateConnectionStatus(true);
            return { cloudSaved: true, inserted: inserted.length, updated: updated.length, deleted: deleted.length };
        } catch (error) {
            console.error('Supabase: no se pudieron guardar las tareas.', error);
            UI.updateConnectionStatus(false, error.message);
            return { cloudSaved: false, error };
        }
    },

    async getNotes() {
        if (!supabaseClient) return [];

        try {
            const { data, error } = await supabaseClient
                .from('notes')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Supabase: no se pudieron cargar las notas.', error);
                return [];
            }

            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Supabase: error cargando notas.', error);
            return [];
        }
    },

    async saveNote(note) {
        if (!supabaseClient) return { cloudSaved: false };

        try {
            const { data, error } = await supabaseClient
                .from('notes')
                .insert([note])
                .select()
                .single();

            if (error) {
                console.error('Supabase: no se pudo guardar la nota.', error);
                return { cloudSaved: false, error };
            }

            return { cloudSaved: true, data };
        } catch (error) {
            console.error('Supabase: error guardando nota.', error);
            return { cloudSaved: false, error };
        }
    },

    async getMembers() {
        if (!supabaseClient) return [];

        try {
            const { data, error } = await supabaseClient
                .from('members')
                .select('name')
                .order('name', { ascending: true });

            if (error) {
                console.error('Supabase: no se pudieron cargar los miembros.', error);
                return [];
            }

            return (data || []).map(item => normalizeText(item.name)).filter(Boolean);
        } catch (error) {
            console.error('Supabase: error cargando miembros.', error);
            return [];
        }
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


    async getRequesters() {
        if (!supabaseClient) return [];

        try {
            const { data, error } = await supabaseClient
                .from('requesters')
                .select('name')
                .order('name', { ascending: true });

            if (error) {
                console.error('Supabase: no se pudieron cargar los solicitantes.', error);
                return [];
            }

            return (data || []).map(item => normalizeText(item.name)).filter(Boolean);
        } catch (error) {
            console.error('Supabase: error cargando solicitantes.', error);
            return [];
        }
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

};

const AuthService = {
    usernameToEmail: (username) => {
        const cleanUsername = normalizeUsername(username);
        if (!cleanUsername) return '';
        return `${cleanUsername}@designhub.local`;
    },

    login: async (username, password) => {
        if (!supabaseClient) {
            console.error('Supabase Auth no está disponible.');
            UI.showToast('No fue posible conectar con el servicio de autenticación.', 'error');
            return false;
        }

        const userClean = normalizeUsername(username);
        const passClean = String(password ?? '');
        if (!userClean || !passClean) return false;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: AuthService.usernameToEmail(userClean),
                password: passClean
            });

            if (error || !data?.user) {
                const message = error?.message || 'Supabase no devolvió un usuario autenticado.';
                console.error('Inicio de sesión rechazado:', error);
                const loginError = document.getElementById('loginError');
                if (loginError) {
                    loginError.textContent = `No fue posible iniciar sesión: ${message}`;
                    loginError.style.display = 'block';
                }
                return false;
            }

            const profile = await DataService.getProfileByAuthId(data.user.id);

            if (!profile) {
                const message = 'La autenticación funcionó, pero no existe un perfil válido para este usuario en public.profiles.';
                console.error(message, { authUserId: data.user.id });
                const loginError = document.getElementById('loginError');
                if (loginError) {
                    loginError.textContent = message;
                    loginError.style.display = 'block';
                }
                await supabaseClient.auth.signOut();
                return false;
            }

            const sessionUser = {
                id: data.user.id,
                username: profile.username || userClean,
                name: profile.name || userClean,
                role: profile.role,
                avatar: profile.avatar || '',
                theme: profile.theme || '#4f46e5'
            };

            UI.updateConnectionStatus(true);
            return true;
        } catch (error) {
            console.error('Error durante la autenticación con Supabase:', error);
            UI.showToast('No fue posible iniciar sesión. Inténtalo nuevamente.', 'error');
            return false;
        }
    },

    getUser: async () => {
        if (!supabaseClient) return null;

        try {
            const { data, error } = await supabaseClient.auth.getUser();

            if (error || !data?.user) {
                return null;
            }

            const authUser = data.user;
            let username = normalizeUsername(authUser.user_metadata?.username || '');
            if (!username && authUser.email) username = normalizeUsername(authUser.email.split('@')[0]);
            if (!username) return null;

            const profile = await DataService.getProfileByAuthId(authUser.id);
            if (!profile) {
                console.error(`No existe un perfil de Supabase para el usuario "${username}".`);
                await supabaseClient.auth.signOut();
                return null;
            }

            const sessionUser = {
                id: authUser.id,
                username: profile.username || username,
                name: profile.name || username,
                role: profile.role,
                avatar: profile.avatar || '',
                theme: profile.theme || '#4f46e5'
            };

            return sessionUser;
        } catch (error) {
            console.error('No fue posible validar la sesión:', error);
            return null;
        }
    },

    logout: async () => {
        try {
            if (supabaseClient) {
                const { error } = await supabaseClient.auth.signOut();
                if (error) console.error('Error cerrando sesión en Supabase:', error);
            }
        } catch (error) {
            console.error('Error inesperado cerrando sesión:', error);
        } finally {
            window.location.reload();
        }
    }
};


/* =========================================
   UI COMPONENT: CUSTOM DROPDOWNS + ACCESIBILIDAD
   ========================================= */
function ensureFlatpickrFormFieldIds(instance, prefix = 'flatpickr') {
    if (!instance) return;

    const source = instance.input;
    const baseId = source?.id || `${prefix}-${createId()}`;
    const baseName = source?.name || baseId;
    const altInput = instance.altInput;

    if (altInput) {
        altInput.id = `${baseId}-display`;
        altInput.name = `${baseName}-display`;

        // Flatpickr oculta el input original y crea un campo visible alternativo.
        // No manipulamos <label for> aquí: el campo visible recibe su propia
        // etiqueta accesible para que la asociación no dependa del timing de Flatpickr.
        const sourceAriaLabel = source?.getAttribute('aria-label');
        if (sourceAriaLabel) {
            altInput.setAttribute('aria-label', sourceAriaLabel);
        } else if (!altInput.getAttribute('aria-label')) {
            altInput.setAttribute('aria-label', baseName);
        }
    }

    const calendar = instance.calendarContainer;
    if (!calendar) return;

    calendar.querySelectorAll('input, select, textarea').forEach((field, index) => {
        if (!field.id) field.id = `${baseId}-calendar-field-${index + 1}`;
        if (!field.name) field.name = `${baseName}-calendar-field-${index + 1}`;
    });
}

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

                select.dispatchEvent(new Event('change', { bubbles: true }));
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
    selectedTaskId: null,
    cropperInstance: null,

    async init() {
        clearLegacyLocalData();
        this.user = await AuthService.getUser();
        
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

        const loginForm = document.getElementById('loginForm');
        if (loginForm && !loginForm.dataset.bound) {
            loginForm.dataset.bound = 'true';
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const user = document.getElementById('usernameInput').value;
                const pass = document.getElementById('passwordInput').value;
                const loginError = document.getElementById('loginError');
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                if (loginError) {
                    loginError.textContent = '';
                    loginError.style.display = 'none';
                }
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.setAttribute('aria-busy', 'true');
                    submitBtn.dataset.originalText = submitBtn.textContent;
                    submitBtn.textContent = 'Verificando…';
                }
                try {
                    if (await AuthService.login(user, pass)) {
                        window.location.reload();
                    }
                } catch (err) {
                    console.error('Error inesperado al iniciar sesión:', err);
                    if (loginError) {
                        loginError.textContent = `Error al iniciar sesión: ${err?.message || err}`;
                        loginError.style.display = 'block';
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.removeAttribute('aria-busy');
                        submitBtn.textContent = submitBtn.dataset.originalText || 'Ingresar al workspace';
                    }
                }
            });
        }
    },

    setupCrossTabSync() {
        // La sincronización entre pestañas se realiza mediante Supabase Realtime.
    },

    setupRealtimeSubscription() {
        if (!supabaseClient) return;

        supabaseClient
            .channel('design-hub-tasks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async () => {
                await this.loadData();
                this.renderBoard();
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime: no fue posible suscribirse a tareas.');
                }
            });

        supabaseClient
            .channel('design-hub-notes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, async () => {
                const panel = document.getElementById('notesPanel');
                if (panel && !panel.classList.contains('open')) {
                    document.getElementById('btnToggleNotes')
                        .querySelector('.notification-badge')?.classList.add('active');
                }
                this.notes = await DataService.getNotes();
                this.renderNotes();
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime: no fue posible suscribirse a notas.');
                }
            });
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
            onReady: (selectedDates, dateStr, instance) => {
                ensureFlatpickrFormFieldIds(instance, 'filter-date');
            },
            onChange: (dates) => { this.filterDates = dates; this.renderBoard(); }
        });
        
        flatpickr(".modal-date", { 
            locale: "es", dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", disableMobile: "true",
            appendTo: document.body,
            onReady: (selectedDates, dateStr, instance) => {
                ensureFlatpickrFormFieldIds(instance, 'modal-date');
            }
        });
    },

    markAsUnsaved() {
        this.hasUnsavedChanges = true;
        document.getElementById('unsavedChangesBar').classList.add('active');
    },

    async saveChanges() {
        const result = await DataService.saveTasks(this.tasks, this.originalTasks);

        if (!result.cloudSaved) {
            const detail = result.error?.message ? `: ${result.error.message}` : '';
            UI.showToast(`No se pudieron guardar los cambios${detail}`, 'error', 7000);
            return;
        }

        const freshTasks = await DataService.getTasks();
        this.originalTasks = JSON.parse(JSON.stringify(freshTasks));
        this.tasks = JSON.parse(JSON.stringify(freshTasks));
        this.hasUnsavedChanges = false;
        document.getElementById('unsavedChangesBar').classList.remove('active');
        UI.showToast("Cambios guardados con éxito", "success");
        this.renderAll();
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
        this.setupDynamicEventDelegation();

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
                isStarred: false,
                notes: normalizeText(document.getElementById('taskNotes')?.value)

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


    setupDynamicEventDelegation() {
        /*
         * Los elementos de tareas, miembros y solicitantes se generan
         * dinámicamente. En lugar de insertar JavaScript dentro del HTML
         * (onclick/onchange/onkeydown), centralizamos sus eventos aquí.
         */
        document.addEventListener('click', async (event) => {
            const target = event.target.closest('[data-action]');

            if (!target) return;

            const action = target.dataset.action;
            const taskId = target.dataset.taskId;

            switch (action) {
                case 'remove-member': {
                    const index = Number(target.dataset.index);
                    if (!Number.isInteger(index) || index < 0 || index >= this.members.length) return;
                    if (!confirm('¿Quitar del equipo?')) return;

                    const removedName = this.members[index];
                    const removed = await DataService.removeMember(removedName);
                    if (!removed) {
                        UI.showToast('No fue posible eliminar el colaborador.', 'error');
                        return;
                    }

                    this.members.splice(index, 1);
                    this.usersList = await DataService.getUsers();
                    this.renderAll();
                    UI.showToast('Colaborador eliminado', 'success');
                    break;
                }

                case 'remove-requester': {
                    const index = Number(target.dataset.index);
                    if (!Number.isInteger(index) || index < 0 || index >= this.requesters.length) return;
                    if (!confirm('¿Eliminar solicitante?')) return;

                    const removedName = this.requesters[index];
                    const removed = await DataService.removeRequester(removedName);
                    if (!removed) {
                        UI.showToast('No fue posible eliminar el solicitante.', 'error');
                        return;
                    }

                    this.requesters.splice(index, 1);
                    this.renderAll();
                    UI.showToast('Solicitante eliminado', 'success');
                    break;
                }

                case 'toggle-star':
                    if (taskId) {
                        this.toggleTaskStar(taskId);
                    }
                    break;

                case 'toggle-status':
                    if (taskId) {
                        this.toggleTaskStatus(taskId);
                    }
                    break;

                case 'edit-task':
                    if (taskId) {
                        this.openEditModal(taskId);
                    }
                    break;

                case 'delete-task':
                    if (!taskId) return;

                    if (confirm('¿Eliminar?')) {
                        this.tasks = this.tasks.filter(
                            task => task.id !== taskId
                        );

                        this.markAsUnsaved();
                        this.renderBoard();

                        UI.showToast(
                            'Tarea eliminada',
                            'success'
                        );
                    }
                    break;

                default:
                    break;
            }
        });

        document.addEventListener('change', (event) => {
            const target = event.target.closest('[data-action]');

            if (!target) return;

            const action = target.dataset.action;
            const taskId = target.dataset.taskId;

            if (!taskId) return;

            switch (action) {
                case 'toggle-completed':
                    this.updateTask(
                        taskId,
                        'status',
                        target.checked
                            ? 'Entregado'
                            : 'En curso',
                        true
                    );
                    break;

                case 'change-assignee':
                    this.updateTask(
                        taskId,
                        'assignee',
                        target.value,
                        false
                    );
                    break;

                default:
                    break;
            }
        });

        document.addEventListener('keydown', (event) => {
            const target = event.target.closest('[data-action]');

            if (!target) return;

            if (
                target.dataset.action !== 'toggle-status' ||
                (event.key !== 'Enter' && event.key !== ' ')
            ) {
                return;
            }

            event.preventDefault();

            const taskId = target.dataset.taskId;

            if (taskId) {
                this.toggleTaskStatus(taskId);
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
                const unicode = event?.detail?.unicode;
                if (!unicode || !input) return;
                input.value += unicode;
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

            if (!result.cloudSaved) {
                UI.showToast("No se pudo guardar la nota en la nube.", "error");
                return;
            }

            this.notes.push(result.data || newNote);
            input.value = '';
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

        const fragment = document.createDocumentFragment();
        this.notes.forEach(n => {
            const dateObj = new Date(n.created_at);
            const dateStr = `${dateObj.getDate().toString().padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
            const isMine = n.author === this.user.name;
            const authorColor = this.getColor(n.author);

            const message = document.createElement('div');
            message.className = `chat-msg ${isMine ? 'mine' : 'other'}`;

            const meta = document.createElement('div');
            meta.className = 'chat-meta';
            const author = document.createElement('span');
            author.textContent = isMine ? 'Tú' : normalizeText(n.author);
            author.style.color = isMine ? 'var(--text-muted)' : authorColor;
            author.style.fontWeight = '700';
            const time = document.createElement('span');
            time.textContent = dateStr;
            meta.append(author, time);

            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${isMine ? '' : 'chat-bubble-other'}`;
            bubble.textContent = normalizeText(n.content);
            if (isMine) {
                bubble.style.backgroundColor = 'var(--primary-cold)';
                bubble.style.color = '#ffffff';
            } else {
                bubble.style.borderLeftColor = authorColor;
            }
            message.append(meta, bubble);
            fragment.appendChild(message);
        });
        container.replaceChildren(fragment);
        
        container.scrollTop = container.scrollHeight;
    },

    openEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        document.getElementById('editTaskId').value = task.id;
        document.getElementById('editTaskName').value = task.name;
        const editNotes = document.getElementById('editTaskNotes');
        if (editNotes) editNotes.value = task.notes || '';
        
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
            const avatar = sanitizeAvatarUrl(avatarData);
            const theme = normalizeText(selectedTheme) || '#4f46e5';

            if (!supabaseClient || !this.user.id) {
                UI.showToast('No se pudo identificar tu perfil en Supabase.', 'error');
                return;
            }

            const saved = await DataService.updateProfile(this.user.id, { avatar, theme });
            if (!saved) {
                UI.showToast('No fue posible guardar el perfil en la nube.', 'error');
                return;
            }

            this.user.avatar = avatar;
            this.user.theme = theme;
            UI.showToast('Perfil actualizado', 'success');
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
                const saved = await DataService.addMember(name);
                if (!saved) {
                    UI.showToast("No fue posible guardar el colaborador en la nube.", "error");
                    return;
                }
                this.members.push(name);
                this.usersList = await DataService.getUsers();
                input.value = ''; 
                this.renderAll();
                UI.showToast("Colaborador añadido", "success");
            }
        });

        document.getElementById('addRequesterForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('newRequesterInput');
            const name = normalizeText(input.value);
            if (name && !this.requesters.some(r => r.toLowerCase() === name.toLowerCase())) {
                const saved = await DataService.addRequester(name);
                if (!saved) {
                    UI.showToast("No fue posible guardar el solicitante en la nube.", "error");
                    return;
                }
                this.requesters.push(name);
                input.value = ''; 
                this.renderAll();
                UI.showToast("Solicitante añadido", "success");
            }
        });
        
    },

    renderAll() {
        this.renderDropdowns();
        this.renderTags();
        this.renderBoard();
    },

    renderDropdowns() {
        const buildOptions = (select, options, placeholder) => {
            if (!select) return;
            const fragment = document.createDocumentFragment();

            if (placeholder) {
                const option = document.createElement('option');
                option.value = 'Todos';
                option.textContent = placeholder;
                fragment.appendChild(option);
            }

            options.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                fragment.appendChild(option);
            });

            select.replaceChildren(fragment);
        };

        ['assignee', 'filterAssignee'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            const options = ['No asignado', ...this.members];
            buildOptions(
                el,
                options,
                id === 'filterAssignee' ? 'Asignación: Todos' : null
            );
        });

        ['requesterSelect', 'filterRequester', 'editRequesterSelect'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            buildOptions(
                el,
                this.requesters,
                id === 'filterRequester' ? 'Solicitante: Todos' : null
            );
        });

        buildCustomSelects(document.querySelector('.inline-filters-bar'));
        buildCustomSelects(document.querySelector('#taskForm'));
        buildCustomSelects(document.querySelector('#editTaskForm'));
    },

    renderTags() {
        if (this.user.role !== 'admin') return;

        const mList = document.getElementById('membersList');
        const rList = document.getElementById('requestersList');
        if (!mList || !rList) return;

        const membersFragment = document.createDocumentFragment();

        this.members.forEach((member, index) => {
            const safeName = normalizeText(member);
            const color = this.getColor(member);

            const chip = document.createElement('div');
            chip.className = 'member-chip';
            chip.style.color = color;
            chip.style.backgroundColor = `${color}20`;
            chip.style.borderColor = `${color}40`;

            const name = document.createElement('span');
            name.textContent = safeName;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'remove-member';
            button.setAttribute('aria-label', `Eliminar ${safeName}`);
            button.dataset.action = 'remove-member';
            button.dataset.index = String(index);

            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'x');

            button.appendChild(icon);
            chip.append(name, button);
            membersFragment.appendChild(chip);
        });

        const requestersFragment = document.createDocumentFragment();

        this.requesters.forEach((requester, index) => {
            const safeName = normalizeText(requester);

            const chip = document.createElement('div');
            chip.className = 'member-chip';

            const name = document.createElement('span');
            name.textContent = safeName;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'remove-member';
            button.setAttribute('aria-label', `Eliminar ${safeName}`);
            button.dataset.action = 'remove-requester';
            button.dataset.index = String(index);

            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'x');

            button.appendChild(icon);
            chip.append(name, button);
            requestersFragment.appendChild(chip);
        });

        mList.replaceChildren(membersFragment);
        rList.replaceChildren(requestersFragment);

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
        const t = this.tasks.find(x => String(x.id) === String(id));
        if (t) {
            t[field] = field === 'isStarred' ? Boolean(value) : normalizeText(value);
            this.selectedTaskId = String(id);
            this.markAsUnsaved();
            this.renderWorkloadChart(this.tasks.filter(x => x.status !== 'Entregado'));
            if (shouldRender) this.renderBoard();
        }
    },

    selectTask(taskId, render = false) {
        const id = taskId == null ? null : String(taskId);
        if (id && !this.tasks.some(t => String(t.id) === id)) return;
        this.selectedTaskId = id;

        document.querySelectorAll('.task-table tr[data-task-row]').forEach(row => {
            row.classList.toggle('task-selected', row.dataset.taskRow === id);
        });
        document.querySelectorAll('.request-item[data-task-row]').forEach(item => {
            item.classList.toggle('task-selected', item.dataset.taskRow === id);
        });

        if (render) this.renderBoard();
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
        const activeFragment = document.createDocumentFragment();
        const completedFragment = document.createDocumentFragment();
        const sidebarFragment = document.createDocumentFragment();
        const sidebarCompletedFragment = document.createDocumentFragment();

        document.getElementById('countPrioridades').textContent = activas.length;
        document.getElementById('countRealizadas').textContent = completadas.length;

        this.renderWorkloadChart(activas);

        const myTasks = this.tasks.filter(t => t.status !== 'Entregado' && t.assignee === this.user.name).sort(sortTasks);
        
        myTasks.forEach(t => {
            const li = document.createElement('li');
            // Añadir clase de estrella para estilar en el CSS
            li.className = `request-item ${t.isStarred ? 'task-starred' : ''} ${this.selectedTaskId === String(t.id) ? 'task-selected' : ''}`;
            li.tabIndex = 0; 
            li.id = `li-${t.id}`;
            li.dataset.taskRow = String(t.id);
            
            // Prevent Event Bubbling
            const handleExpand = (e) => {
                if(e.target.closest('input, button')) return;
                document.querySelectorAll('.request-item.expanded').forEach(el => { if(el !== li) el.classList.remove('expanded'); });
                const exp = li.classList.toggle('expanded');
                document.querySelectorAll('.task-table tr').forEach(tr => tr.classList.remove('expanded-row'));
            };

            li.onclick = (e) => {
                if (e.target.closest('input, button')) return;
                this.selectTask(t.id);
                handleExpand(e);
            };
            li.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectTask(t.id);
                    handleExpand(e);
                }
            };
            
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
                        <button type="button" class="btn-star ${t.isStarred ? 'active' : ''}" data-action="toggle-star" data-task-id="${escapeHTML(t.id)}" aria-label="Destacar">
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
            sidebarFragment.appendChild(li);
        });
        if(myTasks.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'request-item';
            empty.style.cssText = 'color:var(--text-muted); text-align:center; padding:20px 10px; border:none; box-shadow:none; cursor:default;';
            empty.textContent = 'No tienes tareas asignadas';
            sidebarFragment.appendChild(empty);
        }
        sList.replaceChildren(sidebarFragment);

        let assigneeOpts = `<option value="No asignado">No asignado</option>` + this.members.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');
        
        activas.forEach(t => {
            const tr = document.createElement('tr');
            tr.id = `tr-${t.id}`;
            tr.className = `${t.isStarred ? 'task-starred' : ''} ${this.selectedTaskId === String(t.id) ? 'task-selected' : ''}`.trim();
            tr.dataset.taskRow = String(t.id);
            
            const colorHex = this.getColor(t.assignee);
            const isCurso = t.status === 'En curso';
            
            tr.addEventListener('click', (e) => {
                // Ignore clicks on buttons to prevent bubbling collision
                if (e.target.closest('select, input, button, .status-switch, .inline-date-picker, .custom-checkbox, .action-buttons, a, .btn-star')) {
                    return;
                }
                this.selectTask(t.id);
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
                <td style="text-align:center;" data-label="Completada"><input type="checkbox" id="complete-task-${escapeHTML(t.id)}" name="complete-task-${escapeHTML(t.id)}" class="custom-checkbox" aria-label="Marcar como entregado" data-action="toggle-completed" data-task-id="${escapeHTML(t.id)}"></td>
                <td data-label="Solicitud">
                    <div class="req-title-cell">
                        <strong>
                            <button type="button" class="btn-star ${t.isStarred ? 'active' : ''}" data-action="toggle-star" data-task-id="${escapeHTML(t.id)}" aria-label="Destacar">
                                <i data-lucide="star"></i>
                            </button>
                            <span class="req-title-text">${escapeHTML(t.name)}</span>
                        </strong>
                        <span>${escapeHTML(t.requester)}</span>
                    </div>
                </td>
                <td data-label="Asignación">
                    <select id="assignee-${escapeHTML(t.id)}" name="assignee-${escapeHTML(t.id)}" class="native-select-hidden table-select inline-assignee" aria-label="Cambiar asignación" data-color="${escapeHTML(colorHex)}" data-action="change-assignee" data-task-id="${escapeHTML(t.id)}">
                        ${assigneeOpts.replace(`value="${t.assignee}"`, `value="${t.assignee}" selected`)}
                    </select>
                </td>
                <td class="date-info" data-label="Fechas (Rec - Ent)">
                    <span class="date-req">R: ${t.dateReceived ? t.dateReceived.split('-').reverse().join('/') : 'N/A'}</span>
                    <input type="text" id="delivery-date-${escapeHTML(t.id)}" name="delivery-date-${escapeHTML(t.id)}" class="inline-date-picker ${dateClass}" data-id="${escapeHTML(t.id)}" aria-label="Cambiar fecha de entrega" data-received="${escapeHTML(t.dateReceived || "")}" value="${dateDeliveredVal}" placeholder="Seleccionar">
                </td>
                <td data-label="Estado">
                    <div id="status-switch-${t.id}" 
                         class="status-switch ${isCurso ? 'curso' : 'cola'}" 
                         role="switch" 
                         aria-checked="${isCurso ? 'true' : 'false'}" 
                         tabindex="0"
                         data-action="toggle-status" data-task-id="${escapeHTML(t.id)}">
                        <div class="switch-track"><div class="switch-thumb"></div></div>
                        <span class="switch-label">${escapeHTML(t.status)}</span>
                    </div>
                </td>
                <td style="text-align:center;" data-label="Acciones">
                    <div class="action-buttons">
                        <button type="button" class="btn-icon edit" aria-label="Editar tarea" data-action="edit-task" data-task-id="${escapeHTML(t.id)}"><i data-lucide="edit-3"></i></button>
                        <button type="button" class="btn-icon delete" aria-label="Eliminar tarea" data-action="delete-task" data-task-id="${escapeHTML(t.id)}"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            `;
            activeFragment.appendChild(tr);
        });
        if(activas.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.style.cssText = 'text-align:center; padding:40px; color:var(--text-muted);';
            cell.textContent = 'No hay tareas pendientes.';
            row.appendChild(cell);
            activeFragment.appendChild(row);
        }
        tBody.replaceChildren(activeFragment);

        completadas.forEach(t => {
            const li = document.createElement('li');
            li.className = `request-item completed-item ${t.isStarred ? 'task-starred' : ''}`;
            li.innerHTML = `
                <div style="display:flex; gap:10px;">
                    <input type="checkbox" id="complete-task-${escapeHTML(t.id)}-completed" name="complete-task-${escapeHTML(t.id)}-completed" class="custom-checkbox" aria-label="Desmarcar como entregado" checked data-action="toggle-completed" data-task-id="${escapeHTML(t.id)}">
                    <div style="width: 100%;">
                        <div class="req-name-text" style="text-decoration: line-through; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">
                            ${t.isStarred ? '<i data-lucide="star" style="width: 12px; height: 12px; color: #f59e0b; fill: #f59e0b; margin-right: 4px;"></i>' : ''}
                            ${escapeHTML(t.name)}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; font-weight:500;">Entregado: ${t.dateDelivered ? t.dateDelivered.split('-').reverse().join('/') : 'N/A'} | Por: ${escapeHTML(t.assignee)}</div>
                    </div>
                </div>
            `;
            sidebarCompletedFragment.appendChild(li);
        });
        if(completadas.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'request-item';
            empty.style.cssText = 'color:var(--text-muted); text-align:center; padding:20px 10px; border:none; box-shadow:none; cursor:default; background:transparent;';
            empty.textContent = 'Sin historial';
            sidebarCompletedFragment.appendChild(empty);
        }
        sCompList.replaceChildren(sidebarCompletedFragment);

        buildCustomSelects(tBody);
        
        this.fpInstances = flatpickr(".inline-date-picker", {
            locale: "es",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            altInputClass: "inline-date-picker-alt",
            disableMobile: "true",
            appendTo: document.body,
            onReady: (selectedDates, dateStr, instance) => {
                ensureFlatpickrFormFieldIds(instance, 'inline-date');
            },
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

        const workload = Object.fromEntries(this.members.map(member => [member, 0]));
        workload['No asignado'] = 0;

        activasTasks.forEach(task => {
            const assignee = task.assignee || 'No asignado';
            workload[assignee] = (workload[assignee] || 0) + 1;
        });

        const sortedWorkload = Object.entries(workload)
            .sort((a, b) => b[1] - a[1]);

        const maxTasks = sortedWorkload.reduce(
            (max, [, count]) => Math.max(max, count),
            0
        );

        const fragment = document.createDocumentFragment();

        const findUser = (name) => {
            if (!name || name === 'No asignado') return null;
            const normalized = normalizeText(name).toLowerCase();
            return this.usersList.find(user => {
                const userName = normalizeText(user?.name).toLowerCase();
                const username = normalizeText(user?.username).toLowerCase();
                return userName === normalized || username === normalized;
            }) || null;
        };

        const createAvatar = (name, color) => {
            const avatar = document.createElement('div');
            avatar.className = 'workload-avatar';
            avatar.setAttribute('aria-hidden', 'true');
            avatar.style.setProperty('--avatar-color', sanitizeThemeColor(color, '#4f46e5'));

            const user = findUser(name);
            const avatarUrl = sanitizeAvatarUrl(user?.avatar);

            if (avatarUrl) {
                const image = document.createElement('img');
                image.src = avatarUrl;
                image.alt = '';
                image.loading = 'lazy';
                image.decoding = 'async';
                image.addEventListener('error', () => {
                    image.remove();
                    avatar.textContent = getInitials(name);
                    avatar.classList.add('workload-avatar-fallback');
                }, { once: true });
                avatar.appendChild(image);
            } else if (name !== 'No asignado') {
                avatar.textContent = getInitials(name);
                avatar.classList.add('workload-avatar-fallback');
            } else {
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', 'user-round');
                avatar.appendChild(icon);
            }

            return avatar;
        };

        sortedWorkload.forEach(([name, count]) => {
            if (count === 0 && name === 'No asignado') return;

            const percentage = maxTasks === 0 ? 0 : (count / maxTasks) * 100;
            const color = this.getColor(name);

            const item = document.createElement('div');
            item.className = 'workload-item';

            const header = document.createElement('div');
            header.className = 'workload-header';

            const identity = document.createElement('div');
            identity.className = 'workload-identity';

            identity.appendChild(createAvatar(name, color));

            const nameEl = document.createElement('span');
            nameEl.className = 'workload-name';
            nameEl.textContent = normalizeText(name);

            identity.appendChild(nameEl);

            const countEl = document.createElement('span');
            countEl.className = 'workload-count';
            countEl.textContent = String(count);

            header.append(identity, countEl);

            const barBg = document.createElement('div');
            barBg.className = 'workload-bar-bg';

            const barFill = document.createElement('div');
            barFill.className = 'workload-bar-fill';
            barFill.style.width = `${percentage}%`;
            barFill.style.backgroundColor = color;

            barBg.appendChild(barFill);
            item.append(header, barBg);
            fragment.appendChild(item);
        });

        if (maxTasks === 0) {
            const empty = document.createElement('p');
            empty.className = 'workload-empty-state';
            empty.textContent = 'No hay tareas activas';
            fragment.appendChild(empty);
        }

        wContainer.replaceChildren(fragment);
        lucide.createIcons();
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    try { await App.init(); } 
    catch(e) { console.error("FATAL ERROR:", e); alert("Ocurrió un error. Por favor, limpia la caché del navegador."); }
});