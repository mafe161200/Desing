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

// Fechas de negocio: se interpretan siempre en hora local para evitar
// desplazamientos por UTC al comparar valores YYYY-MM-DD.
const parseLocalDate = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
};

const isDateBefore = (first, second) => {
    const a = parseLocalDate(first);
    const b = parseLocalDate(second);
    return Boolean(a && b && a.getTime() < b.getTime());
};

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
        if (parsed.protocol === 'https:') {
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

    async getChangeHistory(limit = 300) {
        if (!supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient
                .from('task_change_history')
                .select('id, task_id, operation, before_data, after_data, changed_by, created_at')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) {
                console.error('Supabase: no se pudo cargar el historial general.', error);
                return [];
            }
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Supabase: error cargando historial general.', error);
            return [];
        }
    },

    async restoreTaskVersion(taskId, snapshot) {
        if (!supabaseClient || !taskId || !snapshot) return { cloudSaved: false };
        try {
            const payload = { name:snapshot.name??'', requester:snapshot.requester??'', assignee:snapshot.assignee??'No asignado', status:snapshot.status??'En cola', dateReceived:snapshot.dateReceived??'', dateDelivered:snapshot.dateDelivered??'', isStarred:Boolean(snapshot.isStarred), notes:snapshot.notes??'' };
            const { data, error } = await supabaseClient.from('tasks').update(payload).eq('id',taskId).select('id').single();
            if(error) throw error;
            return { cloudSaved:Boolean(data) };
        } catch(error) { console.error('Supabase: no se pudo restaurar la versión.',error); return {cloudSaved:false,error}; }
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
    quickFilter: 'all',
    fpInstances: [],
    hasUnsavedChanges: false,
    selectedTaskId: null,
    adjustmentTaskId: null,
    lifecycleRuntime: new Map(),
    currentView: 'board',
    changeHistory: [],
    changeHistoryFilters: { search: '', from: '', to: '', user: 'Todos', operation: 'Todos' },
    historyFilters: {
        month: '',
        requester: 'Todos',
        assignee: 'Todos',
        status: 'Todos',
        search: ''
    },
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
        this.changeHistory = await DataService.getChangeHistory();
        this.rebuildLifecycleRuntime();
        this.setupPlugins();
        this.setupKeyboardShortcuts();
        this.setupEventListeners();
        this.setupHistoryView();
        this.setupChangeHistoryView();
        this.setupNotesPanel();
        this.renderAll();
        this.applyViewFromHash();
        
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
                // Nunca pisar cambios locales todavía no guardados. El siguiente
                // guardado hará una comprobación de concurrencia contra Supabase.
                if (this.hasUnsavedChanges) {
                    UI.showToast('Se detectó un cambio remoto. Tus cambios locales siguen intactos.', 'warning', 7000);
                    return;
                }
                await this.loadData();
                this.changeHistory = await DataService.getChangeHistory();
                if (this.currentView === 'board') this.renderBoard();
                if (this.currentView === 'history') this.renderHistory();
                if (this.currentView === 'change-history') this.renderChangeHistory();
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
                        ?.querySelector('.notification-badge')?.classList.add('active');
                }
                this.notes = await DataService.getNotes();
                this.renderNotes();
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime: no fue posible suscribirse a notas.');
                }
            });

        /*
         * PERFIL COMPARTIDO:
         * avatar + color viven en public.profiles. Cuando un compañero
         * los cambia, todos los clientes vuelven a leer los perfiles y
         * Carga de Trabajo se actualiza sin cerrar sesión ni recargar.
         */
        supabaseClient
            .channel('design-hub-profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
                this.usersList = await DataService.getUsers();

                // Actualiza el usuario actual por si cambió desde otra pestaña.
                if (this.user?.id) {
                    const updatedMe = this.usersList.find(
                        u => String(u.id) === String(this.user.id)
                    );
                    if (updatedMe) {
                        this.user.avatar = updatedMe.avatar || '';
                        this.user.theme = updatedMe.theme || '#4f46e5';
                    }
                }

                this.updateAvatarUI();
                this.renderAll();
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime: no fue posible suscribirse a perfiles.');
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
        const bar = document.getElementById('unsavedChangesBar');
        if (!bar) return;
        bar.classList.add('active');
        bar.setAttribute('aria-hidden', 'false');
        bar.removeAttribute('inert');
    },

    async saveChanges() {
        // Control de concurrencia optimista: si Supabase cambió desde la última
        // carga, no sobrescribimos silenciosamente el trabajo de otro usuario.
        const cloudBeforeSave = await DataService.getTasks();
        const originalById = new Map(this.originalTasks.map(task => [String(task.id), task]));
        const cloudById = new Map(cloudBeforeSave.map(task => [String(task.id), task]));
        const fields = ['name', 'requester', 'assignee', 'status', 'dateReceived', 'dateDelivered', 'isStarred', 'notes'];
        const changedRemotely = cloudBeforeSave.some(cloudTask => {
            const original = originalById.get(String(cloudTask.id));
            if (!original) return false;
            return fields.some(field => String(cloudTask[field] ?? '') !== String(original[field] ?? ''));
        }) || this.originalTasks.some(original => !cloudById.has(String(original.id)));

        if (changedRemotely) {
            UI.showToast('Hay cambios remotos pendientes. Se evitó sobrescribirlos. Revisa y vuelve a cargar antes de guardar.', 'warning', 9000);
            return;
        }

        const result = await DataService.saveTasks(this.tasks, this.originalTasks);

        if (!result.cloudSaved) {
            const detail = result.error?.message ? `: ${result.error.message}` : '';
            // Recuperamos el estado real del servidor para evitar que la interfaz
            // muestre datos que ya no coinciden con la nube.
            const recoveredTasks = await DataService.getTasks();
            if (Array.isArray(recoveredTasks) && recoveredTasks.length) {
                this.originalTasks = JSON.parse(JSON.stringify(recoveredTasks));
            }
            UI.showToast(`No se pudieron guardar todos los cambios${detail}`, 'error', 7000);
            return;
        }

        const freshTasks = await DataService.getTasks();
        this.originalTasks = JSON.parse(JSON.stringify(freshTasks));
        this.tasks = JSON.parse(JSON.stringify(freshTasks));
        this.hasUnsavedChanges = false;
        const bar = document.getElementById('unsavedChangesBar');
        if (bar) {
            bar.classList.remove('active');
            bar.setAttribute('aria-hidden', 'true');
            bar.setAttribute('inert', '');
        }
        UI.showToast('Cambios guardados con éxito', 'success');
        this.renderAll();
    },

    undoChanges() {
        this.tasks = JSON.parse(JSON.stringify(this.originalTasks));
        this.hasUnsavedChanges = false;
        const bar = document.getElementById('unsavedChangesBar');
        if (bar) {
            bar.classList.remove('active');
            bar.setAttribute('aria-hidden', 'true');
            bar.setAttribute('inert', '');
        }
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

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                const search = document.getElementById('taskSearch');
                if (!search) return;
                event.preventDefault();
                search.focus();
                search.select();
            }

            if (event.key === 'Escape' && document.activeElement?.id === 'taskSearch') {
                document.activeElement.blur();
            }
        });

        document.addEventListener('keydown', (event) => {
            const card = event.target.closest?.('[data-summary].is-interactive');
            if (!card || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            card.click();
        });
    },

    setupEventListeners() {
        document.getElementById('btnSave').addEventListener('click', () => this.saveChanges());
        document.getElementById('btnUndo').addEventListener('click', () => this.undoChanges());

        const mTask = document.getElementById('modalTask');
        document.getElementById('btnNewTask').addEventListener('click', () => {
            const form = document.getElementById('taskForm');
            if (form) form.reset();

            const requesterSelect = document.getElementById('requesterSelect');
            const assigneeSelect = document.getElementById('assignee');

            if (requesterSelect) updateCustomSelectUI(requesterSelect, '');
            if (assigneeSelect) updateCustomSelectUI(assigneeSelect, 'No asignado');

            const taskNotes = document.getElementById('taskNotes');
            if (taskNotes) taskNotes.value = '';

            const dateDelivered = document.getElementById('dateDelivered');
            if (dateDelivered?._flatpickr) dateDelivered._flatpickr.clear();

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

        document.getElementById('btnBackToBoard')?.addEventListener('click', () => {
            this.showView('board');
        });

        document.getElementById('btnOpenChangeHistory')?.addEventListener('click', () => {
            this.showView('change-history');
        });
        document.getElementById('btnBackFromChangeHistory')?.addEventListener('click', () => {
            this.showView('board');
        });

        document.getElementById('btnOpenHistoryBottom')?.addEventListener('click', () => {
            this.showView('history');
        });

        document.querySelectorAll('.close-modal').forEach(b => {
            if(b.id !== 'closeProfileModalBtn') {
                b.addEventListener('click', e => {
                    const overlay = e.target.closest('.modal-overlay');
                    overlay?.classList.remove('active');
                    if (overlay?.id === 'modalAdjustment') this.adjustmentTaskId = null;
                });
            }
        });

        const adjustmentForm = document.getElementById('adjustmentForm');
        const adjustmentReason = document.getElementById('adjustmentReason');
        const adjustmentCounter = document.getElementById('adjustmentReasonCount');
        adjustmentReason?.addEventListener('input', () => {
            adjustmentReason.setCustomValidity('');
            if (adjustmentCounter) adjustmentCounter.textContent = `${adjustmentReason.value.length}/${adjustmentReason.maxLength}`;
        });
        adjustmentForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmTaskAdjustment();
        });
        
        ['filterAssignee', 'filterRequester', 'filterStatus', 'filterSort', 'filterCompletion'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', () => this.renderBoard());
        });

        const taskSearch = document.getElementById('taskSearch');
        if (taskSearch) {
            let searchTimer = null;
            taskSearch.addEventListener('input', () => {
                window.clearTimeout(searchTimer);
                searchTimer = window.setTimeout(() => this.renderBoard(), 120);
            });
        }

        document.getElementById('clearFilters').addEventListener('click', () => {
            ['filterAssignee', 'filterRequester', 'filterStatus'].forEach(id => document.getElementById(id).value = 'Todos');
            const taskSearch = document.getElementById('taskSearch');
            if (taskSearch) taskSearch.value = '';
            const filterCompletion = document.getElementById('filterCompletion');
            if (filterCompletion) filterCompletion.value = 'Pendientes';
            document.getElementById('filterSort').value = 'received_asc';
            this.filterDates = [];
            this.quickFilter = 'all';
            document.querySelectorAll('.quick-filter').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.quickFilter === 'all');
            });
            const fpInput = document.getElementById('filterDate');
            if(fpInput && fpInput._flatpickr) fpInput._flatpickr.clear();
            this.renderBoard();
            buildCustomSelects(document.querySelector('.inline-filters-bar')); 
            UI.showToast("Filtros limpiados", "info");
        });

        const setupCharacterCounter = (inputId, counterId) => {
            const input = document.getElementById(inputId);
            const counter = document.getElementById(counterId);
            if (!input || !counter) return;

            const update = () => {
                counter.textContent = `${input.value.length}/${input.maxLength}`;
            };

            input.addEventListener('input', update);
            update();
        };

        setupCharacterCounter('taskName', 'taskNameCount');
        setupCharacterCounter('taskNotes', 'taskNotesCount');

        const taskNameInput = document.getElementById('taskName');
        const taskForm = document.getElementById('taskForm');

        taskNameInput?.addEventListener('input', () => {
            const value = taskNameInput.value.trim();
            taskNameInput.setCustomValidity(
                value.length < 3 ? 'Escribe un título de al menos 3 caracteres.' : ''
            );
        });

        document.getElementById('dateDelivered')?.addEventListener('change', () => {
            const received = normalizeText(document.getElementById('dateReceived')?.value);
            const delivered = normalizeText(document.getElementById('dateDelivered')?.value);
            const input = document.getElementById('dateDelivered');

            if (received && delivered && isDateBefore(delivered, received)) {
                input.setCustomValidity('La fecha de entrega no puede ser anterior a la fecha de solicitud.');
            } else {
                input.setCustomValidity('');
            }
        });

        taskForm?.addEventListener('submit', (e) => {
            const name = document.getElementById('taskName');
            const receivedInput = document.getElementById('dateReceived');
            const deliveryInput = document.getElementById('dateDelivered');
            const requesterInput = document.getElementById('requesterSelect');
            const assigneeInput = document.getElementById('assignee');

            const taskNameRaw = normalizeText(name?.value);
            const requesterRaw = normalizeText(requesterInput?.value);
            const received = normalizeText(receivedInput?.value);
            const delivered = normalizeText(deliveryInput?.value);

            if (name) {
                name.setCustomValidity(
                    taskNameRaw.length < 3 ? 'Escribe un título de al menos 3 caracteres.' : ''
                );
            }

            if (deliveryInput) {
                deliveryInput.setCustomValidity(
                    received && delivered && isDateBefore(delivered, received)
                        ? 'La fecha de entrega no puede ser anterior a la fecha de solicitud.'
                        : ''
                );
            }

            if (!taskForm.checkValidity()) {
                e.preventDefault();
                taskForm.reportValidity();
                return;
            }

            e.preventDefault();

            const isDuplicate = this.tasks.some(t =>
                normalizeText(t.name).toLowerCase() === taskNameRaw.toLowerCase() &&
                normalizeText(t.requester) === requesterRaw
            );

            if (isDuplicate) {
                UI.showToast('Ya existe una tarea idéntica para este solicitante.', 'error');
                return;
            }

            let dateReceivedValue = received;
            if (!dateReceivedValue) {
                const d = new Date();
                dateReceivedValue = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            }

            this.tasks.push({
                id: createId(),
                name: taskNameRaw,
                requester: requesterRaw,
                assignee: normalizeText(assigneeInput?.value),
                status: 'En cola',
                dateReceived: dateReceivedValue,
                dateDelivered: delivered,
                isStarred: false,
                notes: normalizeText(document.getElementById('taskNotes')?.value)
            });

            this.markAsUnsaved();
            taskForm.reset();

            const newRequesterSelect = document.getElementById('requesterSelect');
            const newAssigneeSelect = document.getElementById('assignee');
            if (newRequesterSelect) updateCustomSelectUI(newRequesterSelect, '');
            if (newAssigneeSelect) updateCustomSelectUI(newAssigneeSelect, 'No asignado');

            const receivedPicker = document.getElementById('dateReceived')?._flatpickr;
            const deliveredPicker = document.getElementById('dateDelivered')?._flatpickr;
            if (receivedPicker) receivedPicker.setDate(dateReceivedValue);
            if (deliveredPicker) deliveredPicker.clear();

            document.getElementById('modalTask')?.classList.remove('active');
            this.renderBoard();
            UI.showToast('Solicitud creada. Recuerda guardar los cambios.', 'success');
        });

        document.getElementById('editTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('editTaskId').value;
            const task = this.tasks.find(t => t.id === id);
            
            if (task) {
                const newRecDate = normalizeText(document.getElementById('editDateReceived').value);
                
                if (task.dateDelivered && isDateBefore(task.dateDelivered, newRecDate)) {
                    UI.showToast("La solicitud no puede superar la entrega.", "error"); 
                    return;
                }

                task.name = normalizeText(document.getElementById('editTaskName').value);
                task.requester = normalizeText(document.getElementById('editRequesterSelect').value);
                task.dateReceived = newRecDate;
                task.notes = normalizeText(document.getElementById('editTaskNotes')?.value);
                
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
            const quickFilter = event.target.closest('[data-quick-filter]');
            if (quickFilter) {
                this.quickFilter = quickFilter.dataset.quickFilter || 'all';
                document.querySelectorAll('.quick-filter').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.quickFilter === this.quickFilter);
                });
                this.renderBoard();
                return;
            }

            const summaryCard = event.target.closest('[data-summary]');
            if (summaryCard && summaryCard.classList.contains('is-interactive')) {
                const map = { total: 'all', course: 'course', queue: 'queue', adjustment: 'adjustment', overdue: 'overdue', starred: 'starred' };
                this.quickFilter = map[summaryCard.dataset.summary] || 'all';
                document.querySelectorAll('.quick-filter').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.quickFilter === this.quickFilter);
                });
                this.renderBoard();
                return;
            }

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

                case 'set-status':
                    if (taskId) {
                        this.handleTaskStatusAction(taskId, target.dataset.status);
                    }
                    break;

                case 'request-adjustment':
                    if (taskId) {
                        this.requestTaskAdjustment(taskId);
                    }
                    break;

                case 'start-adjustment':
                    if (taskId) {
                        this.startTaskAdjustment(taskId);
                    }
                    break;

                case 'view-task-notes':
                    if (taskId) this.openTaskNotes(taskId);
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
    },

    setupNotesPanel() {
        const btnToggle = document.getElementById('btnToggleNotes');
        const panel = document.getElementById('notesPanel');
        const overlay = document.getElementById('notesPanelOverlay');
        const btnClose = document.getElementById('btnCloseNotes');
        const form = document.getElementById('noteForm');

        if (!btnToggle.querySelector('.notification-badge')) {
            btnToggle.insertAdjacentHTML('beforeend', '<div class="notification-badge"></div>');
        }

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

    rebuildLifecycleRuntime() {
        this.lifecycleRuntime = new Map();
        (Array.isArray(this.changeHistory) ? this.changeHistory : []).forEach(entry => {
            const taskId = String(entry?.task_id || '');
            if (!taskId) return;
            const after = typeof entry.after_data === 'string' ? (() => { try { return JSON.parse(entry.after_data); } catch { return {}; } })() : (entry.after_data || {});
            const before = typeof entry.before_data === 'string' ? (() => { try { return JSON.parse(entry.before_data); } catch { return {}; } })() : (entry.before_data || {});
            const status = normalizeText(after?.status);
            const previousStatus = normalizeText(before?.status);
            const current = this.lifecycleRuntime.get(taskId) || { deliveries: 0, adjustments: 0 };
            if (status === 'Entregado' && previousStatus !== 'Entregado') current.deliveries += 1;
            if (status === 'Ajuste solicitado' && previousStatus !== 'Ajuste solicitado') current.adjustments += 1;
            this.lifecycleRuntime.set(taskId, current);
        });
    },

    getTaskLifecycle(task) {
        const taskId = String(task?.id || '');
        const runtime = this.lifecycleRuntime.get(taskId) || { deliveries: 0, adjustments: 0 };
        return {
            deliveries: Math.max(Number(task?.deliveryCount) || 0, runtime.deliveries || 0),
            adjustments: Math.max(Number(task?.adjustmentCount) || 0, runtime.adjustments || 0),
            lastDelivery: task?.dateDelivered || ''
        };
    },

    getLatestAdjustmentReason(task) {
        const notes = normalizeText(task?.notes);
        const match = notes.match(/\[AJUSTE SOLICITADO — [^\]]+\]\s*([^\n]+)/i);
        return match ? normalizeText(match[1]) : '';
    },

    recordLifecycleEvent(taskId, type) {
        const id = String(taskId || '');
        if (!id) return;
        const current = this.lifecycleRuntime.get(id) || { deliveries: 0, adjustments: 0 };
        if (type === 'delivery') current.deliveries += 1;
        if (type === 'adjustment') current.adjustments += 1;
        this.lifecycleRuntime.set(id, current);
    },

    setTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task) return;

        const allowedStatuses = ['En cola', 'En curso', 'Ajuste solicitado', 'Entregado'];
        if (!allowedStatuses.includes(newStatus) || task.status === newStatus) return;

        task.status = newStatus;
        this.selectedTaskId = String(taskId);
        this.markAsUnsaved();
        this.renderBoard();
    },

    handleTaskStatusAction(taskId, newStatus) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task) return;

        if (newStatus === 'Entregado') {
            const confirmed = window.confirm('¿Confirmas que deseas entregar esta tarea? Quedará en Solicitudes realizadas y podrá recibir ajustes posteriormente.');
            if (!confirmed) return;
            const task = this.tasks.find(t => String(t.id) === String(taskId));
            if (task) {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                task.dateDelivered = today;
                this.recordLifecycleEvent(taskId, 'delivery');
            }
            this.setTaskStatus(taskId, 'Entregado');
            UI.showToast('Tarea entregada y enviada a Solicitudes realizadas', 'success');
            return;
        }

        this.setTaskStatus(taskId, newStatus);
        UI.showToast(
            newStatus === 'En curso'
                ? 'Tarea iniciada'
                : newStatus === 'Ajuste solicitado'
                    ? 'La tarea quedó marcada con ajuste solicitado'
                    : 'Tarea devuelta a En cola',
            'info'
        );
    },

    requestTaskAdjustment(taskId) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task || task.status !== 'Entregado') return;

        const modal = document.getElementById('modalAdjustment');
        const title = document.getElementById('adjustmentTaskTitle');
        const reason = document.getElementById('adjustmentReason');
        const counter = document.getElementById('adjustmentReasonCount');
        if (!modal || !reason) return;

        this.adjustmentTaskId = String(taskId);
        if (title) title.textContent = normalizeText(task.name);
        reason.value = '';
        if (counter) counter.textContent = `0/${reason.maxLength || 1000}`;
        modal.classList.add('active');
        requestAnimationFrame(() => reason.focus());
    },

    confirmTaskAdjustment() {
        const taskId = this.adjustmentTaskId;
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        const reason = document.getElementById('adjustmentReason');
        const modal = document.getElementById('modalAdjustment');
        if (!task || task.status !== 'Entregado' || !reason || !modal) return;

        const cleanReason = normalizeText(reason.value);
        if (!cleanReason) {
            reason.setCustomValidity('Describe el ajuste solicitado.');
            reason.reportValidity();
            return;
        }
        reason.setCustomValidity('');

        const now = new Date();
        const stamp = now.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
        const author = normalizeText(this.user?.name || this.user?.username || 'Usuario');
        const adjustmentNote = `[AJUSTE SOLICITADO — ${stamp} — ${author}] ${cleanReason}`;
        const previousNotes = normalizeText(task.notes);

        task.status = 'Ajuste solicitado';
        this.recordLifecycleEvent(taskId, 'adjustment');
        task.notes = previousNotes
            ? `${adjustmentNote}\n${previousNotes}`
            : adjustmentNote;

        this.selectedTaskId = String(taskId);
        this.adjustmentTaskId = null;
        modal.classList.remove('active');
        this.markAsUnsaved();
        this.renderBoard();
        UI.showToast('Ajuste registrado. La tarea volvió a gestión como Ajuste solicitado.', 'success', 7000);
    },

    startTaskAdjustment(taskId) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task || task.status !== 'Ajuste solicitado') return;

        task.status = 'En curso';
        this.selectedTaskId = String(taskId);
        this.markAsUnsaved();
        this.renderBoard();
        UI.showToast('Ajuste iniciado. Revisa las notas de la solicitud.', 'info');
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
                e.stopPropagation();
                if (swatch.classList.contains('disabled')) {
                    UI.showToast("Este color ya está en uso", "error");
                    return;
                }

                swatches.forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                selectedTheme = swatch.getAttribute('data-color') || selectedTheme;
            });
        });

        const checkTakenColors = () => {
            const takenColors = this.usersList
                .filter(u => u.username !== this.user.username)
                .map(u => u.theme);

            swatches.forEach(swatch => {
                const c = swatch.getAttribute('data-color');
                const taken = takenColors.includes(c);

                swatch.classList.toggle('disabled', taken);
                swatch.title = taken ? 'Color en uso por otro compañero' : '';
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

    updateDashboardSummary() {
        const active = this.tasks.filter(task => task.status !== 'Entregado');
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const values = {
            summaryTotal: active.length,
            summaryCourse: active.filter(task => task.status === 'En curso').length,
            summaryQueue: active.filter(task => task.status === 'En cola').length,
            summaryOverdue: active.filter(task => task.dateDelivered && task.dateDelivered < todayStr).length,
            summaryStarred: active.filter(task => task.isStarred).length
        };

        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = String(value);
        });
    },

    setupHistoryView() {
        const search = document.getElementById('historySearch');
        const month = document.getElementById('historyMonth');
        const requester = document.getElementById('historyRequester');
        const assignee = document.getElementById('historyAssignee');
        const status = document.getElementById('historyStatus');
        const clear = document.getElementById('clearHistoryFilters');

        if (search) {
            let timer = null;
            search.addEventListener('input', () => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => {
                    this.historyFilters.search = normalizeText(search.value).toLowerCase();
                    this.renderHistory();
                }, 100);
            });
        }

        month?.addEventListener('change', () => {
            this.historyFilters.month = month.value;
            this.renderHistory();
        });

        requester?.addEventListener('change', () => {
            this.historyFilters.requester = requester.value;
            this.renderHistory();
        });

        assignee?.addEventListener('change', () => {
            this.historyFilters.assignee = assignee.value;
            this.renderHistory();
        });

        status?.addEventListener('change', () => {
            this.historyFilters.status = status.value;
            this.renderHistory();
        });

        clear?.addEventListener('click', () => {
            this.historyFilters = {
                month: '',
                requester: 'Todos',
                assignee: 'Todos',
                status: 'Todos',
                search: ''
            };

            if (search) search.value = '';
            if (month) month.value = '';
            if (requester) requester.value = 'Todos';
            if (assignee) assignee.value = 'Todos';
            if (status) status.value = 'Todos';

            this.renderHistory();
        });

        window.addEventListener('hashchange', () => this.applyViewFromHash());
    },

    setupChangeHistoryView() {
        const search = document.getElementById('changeHistorySearch');
        const from = document.getElementById('changeHistoryFrom');
        const to = document.getElementById('changeHistoryTo');
        const user = document.getElementById('changeHistoryUser');
        const operation = document.getElementById('changeHistoryOperation');
        const clear = document.getElementById('clearChangeHistoryFilters');

        search?.addEventListener('input', () => { this.changeHistoryFilters.search = normalizeText(search.value).toLowerCase(); this.renderChangeHistory(); });
        from?.addEventListener('change', () => { this.changeHistoryFilters.from = from.value; this.renderChangeHistory(); });
        to?.addEventListener('change', () => { this.changeHistoryFilters.to = to.value; this.renderChangeHistory(); });
        user?.addEventListener('change', () => { this.changeHistoryFilters.user = user.value; this.renderChangeHistory(); });
        operation?.addEventListener('change', () => { this.changeHistoryFilters.operation = operation.value; this.renderChangeHistory(); });
        clear?.addEventListener('click', () => {
            this.changeHistoryFilters = { search: '', from: '', to: '', user: 'Todos', operation: 'Todos' };
            if (search) search.value = '';
            if (from) from.value = '';
            if (to) to.value = '';
            if (user) user.value = 'Todos';
            if (operation) operation.value = 'Todos';
            this.renderChangeHistory();
        });
    },

    async loadChangeHistory() {
        this.changeHistory = await DataService.getChangeHistory();
        this.renderChangeHistory();
    },

    parseChangeHistoryData(value) {
        if (typeof value === 'string') {
            try { return JSON.parse(value) || {}; } catch { return {}; }
        }
        return value && typeof value === 'object' ? value : {};
    },

    formatChangeHistoryDate(value) {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return 'Fecha no disponible';
        return parsed.toLocaleString('es-CO', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    },

    openChangeHistoryDetail(entry, task, labels, display) {
        document.getElementById('changeHistoryDetailViewer')?.remove();

        const before = this.parseChangeHistoryData(entry.before_data);
        const after = this.parseChangeHistoryData(entry.after_data);
        const fields = Object.keys(labels).filter(field =>
            String(before[field] ?? '') !== String(after[field] ?? '')
        );

        const overlay = document.createElement('div');
        overlay.id = 'changeHistoryDetailViewer';
        overlay.className = 'change-history-detail-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'changeHistoryDetailTitle');

        const card = document.createElement('div');
        card.className = 'change-history-detail-card';

        const header = document.createElement('div');
        header.className = 'change-history-detail-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'change-history-detail-title-wrap';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'history');
        const title = document.createElement('h2');
        title.id = 'changeHistoryDetailTitle';
        title.textContent = entry.operation === 'INSERT' ? 'Solicitud creada' : entry.operation === 'DELETE' ? 'Solicitud eliminada' : 'Detalle del cambio';
        titleWrap.append(icon, title);

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-icon change-history-detail-close';
        close.setAttribute('aria-label', 'Cerrar detalle');
        const closeIcon = document.createElement('i');
        closeIcon.setAttribute('data-lucide', 'x');
        close.appendChild(closeIcon);
        header.append(titleWrap, close);

        const taskName = document.createElement('div');
        taskName.className = 'change-history-detail-task';
        taskName.textContent = task?.name || `Solicitud #${entry.task_id}`;

        const meta = document.createElement('div');
        meta.className = 'change-history-detail-meta';
        const operationText = entry.operation === 'INSERT' ? 'Creación' : entry.operation === 'DELETE' ? 'Eliminación' : 'Modificación';
        meta.textContent = `${operationText} · ${this.formatChangeHistoryDate(entry.created_at)} · ${normalizeText((this.usersList || []).find(u => String(u.id) === String(entry.changed_by))?.name || (this.usersList || []).find(u => String(u.id) === String(entry.changed_by))?.username || 'Usuario')}`;

        const body = document.createElement('div');
        body.className = 'change-history-detail-body';

        if (entry.operation === 'INSERT') {
            const message = document.createElement('p');
            message.className = 'change-history-detail-message';
            message.textContent = 'Se creó esta solicitud.';
            body.appendChild(message);
        } else if (entry.operation === 'DELETE') {
            const message = document.createElement('p');
            message.className = 'change-history-detail-message';
            message.textContent = 'Se eliminó esta solicitud.';
            body.appendChild(message);
        } else if (!fields.length) {
            const message = document.createElement('p');
            message.className = 'change-history-detail-message';
            message.textContent = 'Se registró un cambio sin diferencias de campos disponibles.';
            body.appendChild(message);
        } else {
            const diffList = document.createElement('div');
            diffList.className = 'change-history-diff-list';
            fields.forEach(field => {
                const row = document.createElement('div');
                row.className = 'change-history-diff-row';
                const fieldName = document.createElement('span');
                fieldName.className = 'change-history-diff-label';
                fieldName.textContent = labels[field];
                const values = document.createElement('div');
                values.className = 'change-history-diff-values';
                const beforeValue = document.createElement('span');
                beforeValue.className = 'change-history-diff-before';
                beforeValue.textContent = display(field, before[field]);
                const arrow = document.createElement('i');
                arrow.setAttribute('data-lucide', 'arrow-right');
                const afterValue = document.createElement('span');
                afterValue.className = 'change-history-diff-after';
                afterValue.textContent = display(field, after[field]);
                values.append(beforeValue, arrow, afterValue);
                row.append(fieldName, values);
                diffList.appendChild(row);
            });
            body.appendChild(diffList);
        }

        const footer = document.createElement('div');
        footer.className = 'change-history-detail-footer';
        const closeFooter = document.createElement('button');
        closeFooter.type = 'button';
        closeFooter.className = 'btn btn-secondary';
        closeFooter.textContent = 'Cerrar';
        footer.appendChild(closeFooter);

        if (entry.operation === 'UPDATE' && task && typeof DataService.restoreTaskVersion === 'function') {
            const restore = document.createElement('button');
            restore.type = 'button';
            restore.className = 'btn btn-primary change-history-detail-restore';
            const restoreIcon = document.createElement('i');
            restoreIcon.setAttribute('data-lucide', 'rotate-ccw');
            restore.append(restoreIcon, document.createTextNode(' Restaurar esta versión'));
            restore.addEventListener('click', async () => {
                const confirmed = confirm(`¿Restaurar la solicitud a la versión del ${this.formatChangeHistoryDate(entry.created_at)}? El cambio actual quedará registrado.`);
                if (!confirmed) return;
                restore.disabled = true;
                try {
                    const result = await DataService.restoreTaskVersion(entry.task_id, before);
                    if (!result?.cloudSaved) {
                        restore.disabled = false;
                        UI.showToast('No se pudo restaurar la versión.', 'error');
                        return;
                    }
                    overlay.remove();
                    await this.loadData();
                    await this.loadChangeHistory();
                    UI.showToast('Versión restaurada correctamente.', 'success');
                } catch (error) {
                    console.error('Error al restaurar versión:', error);
                    restore.disabled = false;
                    UI.showToast('No se pudo restaurar la versión.', 'error');
                }
            });
            footer.appendChild(restore);
        }

        card.append(header, taskName, meta, body, footer);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        lucide.createIcons();

        const closeViewer = () => {
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown);
        };
        const onKeyDown = event => {
            if (event.key === 'Escape') closeViewer();
        };
        close.addEventListener('click', closeViewer);
        closeFooter.addEventListener('click', closeViewer);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeViewer();
        });
        document.addEventListener('keydown', onKeyDown);
    },

    renderChangeHistory() {
        const body = document.getElementById('changeHistoryTableBody');
        const empty = document.getElementById('changeHistoryEmpty');

        if (!body || !empty) return;

        const filters = this.changeHistoryFilters || {
            search: '',
            from: '',
            to: '',
            user: 'Todos',
            operation: 'Todos'
        };

        const tasks = Array.isArray(this.tasks) ? this.tasks : [];
        const users = Array.isArray(this.usersList) ? this.usersList : [];

        const taskMap = new Map(
            tasks.map(task => [String(task.id), task])
        );

        const userMap = new Map(
            users.map(user => [
                String(user.id),
                normalizeText(user.name || user.username || 'Usuario')
            ])
        );

        const labels = {
            name: 'Solicitud',
            requester: 'Solicitante',
            assignee: 'Responsable',
            status: 'Estado',
            dateReceived: 'Recepción',
            dateDelivered: 'Entrega',
            isStarred: 'Prioridad',
            notes: 'Notas'
        };

        const display = (field, value) => {
            if (field === 'isStarred') return value ? 'Prioritaria' : 'Normal';
            if (value === null || value === undefined || value === '') return 'Vacío';
            return String(value);
        };

        const changedFields = entry => {
            const before = this.parseChangeHistoryData(entry.before_data);
            const after = this.parseChangeHistoryData(entry.after_data);
            return Object.keys(labels).filter(field =>
                String(before[field] ?? '') !== String(after[field] ?? '')
            );
        };

        const rows = (this.changeHistory || []).filter(entry => {
            const task = taskMap.get(String(entry.task_id));
            const username =
                userMap.get(String(entry.changed_by)) || 'Usuario';
            const before = this.parseChangeHistoryData(entry.before_data);
            const after = this.parseChangeHistoryData(entry.after_data);
            const fields = changedFields(entry);

            const summary = fields.map(field =>
                `${labels[field]} ${display(field, before[field])} ${display(field, after[field])}`
            ).join(' ');

            const haystack = [
                task?.name,
                task?.requester,
                task?.assignee,
                username,
                entry.operation,
                summary
            ].map(normalizeText).join(' ').toLowerCase();

            const date = normalizeText(entry.created_at).slice(0, 10);

            if (filters.search && !haystack.includes(filters.search)) return false;
            if (filters.user !== 'Todos' && username !== filters.user) return false;
            if (filters.operation !== 'Todos' && entry.operation !== filters.operation) return false;
            if (filters.from && date < filters.from) return false;
            if (filters.to && date > filters.to) return false;

            return true;
        });

        const userSelect = document.getElementById('changeHistoryUser');

        if (userSelect && userSelect.options.length <= 1) {
            [...new Set(
                (this.changeHistory || []).map(entry =>
                    userMap.get(String(entry.changed_by)) || 'Usuario'
                )
            )]
                .sort((a, b) => a.localeCompare(b, 'es'))
                .forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    userSelect.appendChild(option);
                });
        }

        body.replaceChildren();

        const count = document.getElementById('changeHistoryCount');
        const result = document.getElementById('changeHistoryResult');

        if (count) count.textContent = String(rows.length);
        if (result) {
            result.textContent =
                `${rows.length} cambio${rows.length === 1 ? '' : 's'}`;
        }

        empty.hidden = rows.length !== 0;

        if (!rows.length) return;

        const fragment = document.createDocumentFragment();

        rows.forEach((entry, index) => {
            const task = taskMap.get(String(entry.task_id));
            const username =
                userMap.get(String(entry.changed_by)) || 'Usuario';

            const before = entry.before_data || {};
            const after = entry.after_data || {};
            const fields = changedFields(entry);

            const item = document.createElement('article');
            item.className = 'change-history-item';
            item.setAttribute('role', 'listitem');
            item.dataset.historyId = String(entry.id);
            item.style.animationDelay =
                `${Math.min(index, 8) * 18}ms`;

            const main = document.createElement('div');
            main.className = 'change-history-main';

            const date = document.createElement('time');
            date.className = 'change-history-date';
            date.dateTime = entry.created_at || '';
            date.textContent = this.formatChangeHistoryDate(entry.created_at);

            const title = document.createElement('div');
            title.className = 'change-history-title';
            title.textContent =
                task?.name || `Solicitud #${entry.task_id}`;

            const meta = document.createElement('div');
            meta.className = 'change-history-meta';

            const operation = document.createElement('span');
            operation.className =
                `change-history-operation ${String(entry.operation || '').toLowerCase()}`;
            operation.textContent =
                entry.operation === 'INSERT'
                    ? 'Creación'
                    : entry.operation === 'DELETE'
                        ? 'Eliminación'
                        : 'Modificación';

            const user = document.createElement('span');
            user.className = 'change-history-user';
            user.textContent = username;

            meta.append(operation, user);

            const detail = document.createElement('div');
            detail.className = 'change-history-detail';

            if (entry.operation === 'INSERT') {
                detail.textContent = 'Se creó la solicitud.';
            } else if (entry.operation === 'DELETE') {
                detail.textContent = 'Se eliminó la solicitud.';
            } else if (!fields.length) {
                detail.textContent = 'Cambio registrado.';
            } else {
                detail.textContent = fields.slice(0, 2).map(field =>
                    `${labels[field]}: ${display(field, before[field])} → ${display(field, after[field])}`
                ).join(' · ');
                if (fields.length > 2) {
                    detail.textContent += ` · +${fields.length - 2} cambio${fields.length - 2 === 1 ? '' : 's'}`;
                }
            }

            main.append(date, title, meta, detail);

            const actions = document.createElement('div');
            actions.className = 'change-history-action';

            const viewButton = document.createElement('button');
            viewButton.type = 'button';
            viewButton.className = 'btn-text change-history-view-detail';
            viewButton.innerHTML = '<i data-lucide="eye"></i> Ver cambios';
            viewButton.setAttribute('aria-label', `Ver cambios de ${title.textContent}`);
            viewButton.addEventListener('click', () => {
                this.openChangeHistoryDetail(entry, task, labels, display);
            });
            actions.appendChild(viewButton);

            item.append(main, actions);
            fragment.appendChild(item);
        });

        body.appendChild(fragment);
    },

    showView(view) {
        const isRequestHistory = view === 'history';
        const isChangeHistory = view === 'change-history';
        const secondary = isRequestHistory || isChangeHistory;
        document.querySelector('.layout-grid')?.toggleAttribute('hidden', secondary);
        document.querySelector('.dashboard-summary')?.toggleAttribute('hidden', secondary);
        const requestHistory = document.getElementById('historyView');
        const changeHistory = document.getElementById('changeHistoryView');
        if (requestHistory) requestHistory.hidden = !isRequestHistory;
        if (changeHistory) changeHistory.hidden = !isChangeHistory;
        this.currentView = isRequestHistory ? 'history' : isChangeHistory ? 'change-history' : 'board';

        const targetHash = isRequestHistory ? '#solicitudes-realizadas' : isChangeHistory ? '#historial-cambios' : '';
        if (targetHash) window.history.pushState(null,'',targetHash);
        else if (window.location.hash) window.history.pushState(null,'',window.location.pathname+window.location.search);

        if (isRequestHistory) this.renderHistory();
        if (isChangeHistory) this.renderChangeHistory();
        if (!secondary) this.renderBoard();

        requestAnimationFrame(() => { if(window.lucide) lucide.createIcons({attrs:{'aria-hidden':'true'}}); });
    },

    applyViewFromHash() {
        const hash=window.location.hash;
        if(hash==='#solicitudes-realizadas') this.showView('history');
        else if(hash==='#historial-cambios') this.showView('change-history');
        else this.showView('board');
    },

    renderHistory() {
        const body = document.getElementById('historyTableBody');
        if (!body) return;

        const filters = this.historyFilters;
        const dateValue = (value) => {
            if (!value) return Number.POSITIVE_INFINITY;
            const parsed = new Date(`${value}T12:00:00`).getTime();
            return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
        };

        const monthOf = (value) => normalizeText(value).slice(0, 7);

        const allTasks = (Array.isArray(this.tasks) ? this.tasks : [])
            .filter(task => this.getTaskLifecycle(task).deliveries > 0);

        const filtered = allTasks
            .filter(task => {
                if (filters.month && monthOf(task.dateReceived) !== filters.month) return false;
                if (filters.requester !== 'Todos' && normalizeText(task.requester) !== filters.requester) return false;
                if (filters.assignee !== 'Todos' && normalizeText(task.assignee) !== filters.assignee) return false;
                if (filters.status !== 'Todos' && normalizeText(task.status) !== filters.status) return false;

                if (filters.search) {
                    const haystack = [
                        task.name,
                        task.requester,
                        task.assignee,
                        task.status,
                        task.notes
                    ].map(normalizeText).join(' ').toLowerCase();

                    if (!haystack.includes(filters.search)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const received = dateValue(b.dateReceived) - dateValue(a.dateReceived);
                if (received !== 0) return received;
                return String(b.id).localeCompare(String(a.id));
            });

        document.getElementById('historyCount').textContent = String(filtered.length);
        document.getElementById('historyStatMonth').textContent =
            String(filtered.filter(task => monthOf(task.dateReceived) === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).length);
        document.getElementById('historyStatCourse').textContent =
            String(filtered.filter(task => normalizeText(task.status) === 'En curso').length);
        const historyAdjustmentStat = document.getElementById('historyStatAdjustments');
        if (historyAdjustmentStat) {
            historyAdjustmentStat.textContent = String(filtered.filter(task => normalizeText(task.status) === 'Ajuste solicitado').length);
        }

        const filterResult = document.getElementById('historyFilterResult');
        if (filterResult) {
            filterResult.textContent = `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`;
        }


        if (!filtered.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 7;
            cell.className = 'history-empty';
            cell.textContent = 'No hay solicitudes que coincidan con los filtros.';
            row.appendChild(cell);
            body.replaceChildren(row);
            return;
        }

        const fragment = document.createDocumentFragment();

        filtered.forEach(task => {
            const row = document.createElement('tr');

            const requestCell = document.createElement('td');
            requestCell.className = 'history-request-cell';

            const title = document.createElement('strong');
            title.textContent = normalizeText(task.name);
            title.title = normalizeText(task.name);

            if (task.isStarred) {
                const star = document.createElement('span');
                star.className = 'history-star';
                star.textContent = '★';
                star.setAttribute('aria-label', 'Prioridad');
                requestCell.append(star);
            }

            requestCell.appendChild(title);

            const lifecycle = this.getTaskLifecycle(task);
            const lifecycleMeta = document.createElement('div');
            lifecycleMeta.className = 'history-lifecycle-meta';
            lifecycleMeta.textContent = `${lifecycle.deliveries} entrega${lifecycle.deliveries === 1 ? '' : 's'} · ${lifecycle.adjustments} ajuste${lifecycle.adjustments === 1 ? '' : 's'}`;
            requestCell.appendChild(lifecycleMeta);
            if (normalizeText(task.status) === 'Ajuste solicitado') {
                const adjustmentReason = this.getLatestAdjustmentReason(task);
                if (adjustmentReason) {
                    const reasonEl = document.createElement('div');
                    reasonEl.className = 'history-adjustment-reason';
                    reasonEl.textContent = `Ajuste: ${adjustmentReason}`;
                    requestCell.appendChild(reasonEl);
                }
            }

            const requesterCell = document.createElement('td');
            requesterCell.textContent = normalizeText(task.requester) || 'No indicado';

            const assigneeCell = document.createElement('td');
            assigneeCell.textContent = normalizeText(task.assignee) || 'No asignado';

            const receivedCell = document.createElement('td');
            receivedCell.textContent = task.dateReceived
                ? task.dateReceived.split('-').reverse().join('/')
                : '—';

            const deliveryCell = document.createElement('td');
            deliveryCell.textContent = task.dateDelivered
                ? `${task.dateDelivered.split('-').reverse().join('/')} · #${Math.max(1, lifecycle.deliveries)}`
                : '—';

            const statusCell = document.createElement('td');
            const status = normalizeText(task.status) || 'Sin estado';
            statusCell.innerHTML = `<span class="history-status ${status === 'En curso' ? 'course' : status === 'Entregado' ? 'done' : status === 'Ajuste solicitado' ? 'adjustment' : 'queue'}">${escapeHTML(status)}</span>`;

            const actionCell = document.createElement('td');
            actionCell.className = 'history-actions-cell';
            if (status === 'Entregado') {
                const returnButton = document.createElement('button');
                returnButton.type = 'button';
                returnButton.className = 'btn-text history-return-button';
                returnButton.textContent = 'Solicitar ajuste';
                returnButton.title = 'Registrar el motivo y devolver la solicitud a gestión';
                returnButton.setAttribute('aria-label', `Solicitar ajuste para ${normalizeText(task.name)}`);
                returnButton.addEventListener('click', () => this.requestTaskAdjustment(task.id));
                actionCell.appendChild(returnButton);
            } else if (status === 'Ajuste solicitado') {
                const startButton = document.createElement('button');
                startButton.type = 'button';
                startButton.className = 'btn-text history-start-adjustment-button';
                startButton.textContent = 'Iniciar ajuste';
                startButton.title = 'Pasar la solicitud a En curso';
                startButton.setAttribute('aria-label', `Iniciar ajuste de ${normalizeText(task.name)}`);
                startButton.addEventListener('click', () => this.startTaskAdjustment(task.id));
                actionCell.appendChild(startButton);
            } else {
                actionCell.textContent = '—';
            }

            row.append(
                requestCell,
                requesterCell,
                assigneeCell,
                receivedCell,
                deliveryCell,
                statusCell,
                actionCell
            );

            fragment.appendChild(row);
        });

        body.replaceChildren(fragment);
    },

    renderAll() {
        this.renderDropdowns();
        this.refreshHistoryFilters();
        this.renderTags();
        this.renderBoard();
        this.renderHistory();
    },

    renderDropdowns() {
        const buildOptions = (select, options, placeholder, emptyOption = false) => {
            if (!select) return;
            const fragment = document.createDocumentFragment();

            if (placeholder) {
                const option = document.createElement('option');
                option.value = emptyOption ? '' : 'Todos';
                option.textContent = placeholder;
                if (emptyOption) option.disabled = true;
                option.selected = true;
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
                id === 'filterRequester' ? 'Solicitante: Todos' : 'Seleccionar solicitante...',
                id !== 'filterRequester'
            );
        });

        buildCustomSelects(document.querySelector('.inline-filters-bar'));
        buildCustomSelects(document.querySelector('#taskForm'));
        buildCustomSelects(document.querySelector('#editTaskForm'));
    },

    refreshHistoryFilters() {
        const requester = document.getElementById('historyRequester');
        const assignee = document.getElementById('historyAssignee');
        if (!requester || !assignee) return;

        const currentRequester = this.historyFilters.requester;
        const currentAssignee = this.historyFilters.assignee;

        const unique = values => [...new Set(
            values.map(normalizeText).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'es'));

        const fill = (select, values, current) => {
            const fragment = document.createDocumentFragment();
            const all = document.createElement('option');
            all.value = 'Todos';
            all.textContent = 'Todos';
            fragment.appendChild(all);

            values.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                fragment.appendChild(option);
            });

            select.replaceChildren(fragment);
            select.value = values.includes(current) ? current : 'Todos';
        };

        fill(requester, unique(this.tasks.map(task => task.requester)), currentRequester);
        fill(assignee, unique(this.tasks.map(task => task.assignee)), currentAssignee);

        this.historyFilters.requester = requester.value;
        this.historyFilters.assignee = assignee.value;
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

    openTaskNotes(taskId) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task) return;

        document.getElementById('taskNotesViewer')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'taskNotesViewer';
        overlay.className = 'task-notes-viewer-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'taskNotesViewerTitle');

        const card = document.createElement('div');
        card.className = 'task-notes-viewer-card';

        const header = document.createElement('div');
        header.className = 'task-notes-viewer-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'task-notes-viewer-title-wrap';

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'message-square-text');

        const title = document.createElement('h2');
        title.id = 'taskNotesViewerTitle';
        title.textContent = 'Notas de la solicitud';

        titleWrap.append(icon, title);

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-icon task-notes-viewer-close';
        close.setAttribute('aria-label', 'Cerrar notas');
        const closeIcon = document.createElement('i');
        closeIcon.setAttribute('data-lucide', 'x');
        close.appendChild(closeIcon);

        header.append(titleWrap, close);

        const taskName = document.createElement('div');
        taskName.className = 'task-notes-viewer-task-name';
        taskName.textContent = normalizeText(task.name);

        const meta = document.createElement('div');
        meta.className = 'task-notes-viewer-meta';
        meta.textContent = `Solicitante: ${normalizeText(task.requester || 'No indicado')}`;

        const body = document.createElement('div');
        body.className = 'task-notes-viewer-body';

        const noteText = document.createElement('p');
        noteText.className = 'task-notes-viewer-text';

        const notes = normalizeText(task.notes);
        noteText.textContent = notes || 'Esta solicitud no tiene notas todavía.';
        if (!notes) body.classList.add('is-empty');

        body.appendChild(noteText);
        card.append(header, taskName, meta, body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        lucide.createIcons();

        const closeViewer = () => {
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') closeViewer();
        };

        close.addEventListener('click', closeViewer);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeViewer();
        });
        document.addEventListener('keydown', onKeyDown);

        requestAnimationFrame(() => overlay.classList.add('active'));
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
        this.updateDashboardSummary();

        const sList = document.getElementById('sidebarList');
        const tBody = document.getElementById('tablePrioridades');
        
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        
        if (this.fpInstances) {
            const instances = Array.isArray(this.fpInstances) ? this.fpInstances : [this.fpInstances];
            instances.forEach(fp => { if (fp && typeof fp.destroy === 'function') fp.destroy(); });
        }
        this.fpInstances = [];

        sList.innerHTML = ''; tBody.innerHTML = '';

        const fAssignee = document.getElementById('filterAssignee').value;
        const fRequester = document.getElementById('filterRequester').value;
        const fStatus = document.getElementById('filterStatus').value;
        const fSearch = normalizeText(document.getElementById('taskSearch')?.value || '').toLowerCase();
        const fCompletion = document.getElementById('filterCompletion')?.value || 'Pendientes';
        const fSortEl = document.getElementById('filterSort');
        const fSort = fSortEl ? fSortEl.value : 'received_asc';

        /*
         * Importante: los filtros generales NO deben eliminar las tareas
         * completadas antes de construir la sección "Realizadas".
         * Antes, el filtro "Pendientes" hacía que "completadas" quedara
         * siempre vacío; por eso una tarea marcada parecía desaparecer.
         */
        const dateValue = (value) => {
            if (!value) return Number.POSITIVE_INFINITY;
            const time = new Date(`${value}T12:00:00`).getTime();
            return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
        };

        const matchesCommonFilters = (t) => {
            const mAsig = fAssignee === 'Todos' || t.assignee === fAssignee;
            const mReq = fRequester === 'Todos' || t.requester === fRequester;
            const mStat = fStatus === 'Todos' || t.status === fStatus;
            const mSearch = !fSearch ||
                normalizeText(t.name).toLowerCase().includes(fSearch) ||
                normalizeText(t.requester).toLowerCase().includes(fSearch) ||
                normalizeText(t.assignee).toLowerCase().includes(fSearch) ||
                normalizeText(t.notes).toLowerCase().includes(fSearch);

            let mQuick = true;
            if (this.quickFilter === 'starred') {
                mQuick = !!t.isStarred;
            } else if (this.quickFilter === 'mine') {
                mQuick = !!this.user && t.assignee === this.user.name;
            } else if (this.quickFilter === 'unassigned') {
                mQuick = !t.assignee || t.assignee === 'No asignado';
            } else if (this.quickFilter === 'overdue') {
                mQuick = t.status !== 'Entregado' && !!t.dateDelivered && dateValue(t.dateDelivered) < Date.now();
            } else if (this.quickFilter === 'today') {
                mQuick = t.status !== 'Entregado' && t.dateDelivered === todayStr;
            } else if (this.quickFilter === 'course') {
                mQuick = t.status === 'En curso';
            } else if (this.quickFilter === 'adjustment') {
                mQuick = t.status === 'Ajuste solicitado';
            } else if (this.quickFilter === 'queue') {
                mQuick = t.status === 'En cola';
            }

            let mDate = true;
            if (this.filterDates.length > 0) {
                if (!t.dateDelivered) {
                    mDate = false;
                } else {
                    const start = new Date(this.filterDates[0]);
                    start.setHours(0, 0, 0, 0);
                    const end = this.filterDates.length > 1
                        ? new Date(this.filterDates[1])
                        : new Date(this.filterDates[0]);
                    end.setHours(23, 59, 59, 999);
                    const taskDate = new Date(t.dateDelivered + 'T12:00:00');
                    mDate = taskDate >= start && taskDate <= end;
                }
            }

            return mAsig && mReq && mStat && mSearch && mQuick && mDate;
        };

        const filtered = this.tasks.filter(matchesCommonFilters);
        // ORDEN POR DEFECTO: fecha de solicitud (recepción),
        // de la más antigua a la más reciente.
        // Las estrellas solo toman prioridad en órdenes alternativos.
        const sortTasks = (a, b) => {
            // Regla por defecto: ⭐ prioridad primero y, dentro de cada grupo,
            // fecha de solicitud (recepción) de más antigua a más reciente.
            if (a.isStarred && !b.isStarred) return -1;
            if (!a.isStarred && b.isStarred) return 1;

            const receivedA = dateValue(a.dateReceived);
            const receivedB = dateValue(b.dateReceived);
            const deliveryA = dateValue(a.dateDelivered);
            const deliveryB = dateValue(b.dateDelivered);

            if (fSort === 'received_asc' || fSort === 'received_desc') {
                const diff = receivedA - receivedB;
                if (diff !== 0) return fSort === 'received_desc' ? -diff : diff;
            } else {
                const diff = deliveryA - deliveryB;
                if (diff !== 0) return fSort === 'desc' ? -diff : diff;
            }

            // Desempate estable y determinista.
            const fallback = receivedA - receivedB;
            if (fallback !== 0) return fallback;
            return String(a.id).localeCompare(String(b.id));
        };

        const activas = filtered.filter(t => t.status !== 'Entregado').sort(sortTasks);
        const completadas = filtered.filter(t => t.status === 'Entregado').sort(sortTasks);
        const boardTasks = fCompletion === 'Realizadas'
            ? completadas
            : fCompletion === 'Todas'
                ? [...activas, ...completadas].sort(sortTasks)
                : activas;
        const activeFragment = document.createDocumentFragment();
        const sidebarFragment = document.createDocumentFragment();

        document.getElementById('countPrioridades').textContent = boardTasks.length;
        const boardHistoryCount = document.getElementById('boardHistoryCount');
        if (boardHistoryCount) boardHistoryCount.textContent = completadas.length;

        this.renderWorkloadChart(activas);

        const myTasks = this.tasks.filter(t => t.status !== 'Entregado' && t.assignee === this.user.name).sort(sortTasks);
        const myTasksBadge = document.querySelector('.sidebar-card:first-child .badge-count');
        if (myTasksBadge) myTasksBadge.textContent = String(myTasks.length);
        
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

            li.addEventListener('click', (e) => {
                if (e.target.closest('input, button')) return;
                this.selectTask(t.id);
                handleExpand(e);
            });

            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectTask(t.id);
                    handleExpand(e);
                }
            });
            
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
                        <span class="req-name-text" title="${escapeHTML(t.name)}">${escapeHTML(t.name)}</span>
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
        
        boardTasks.forEach(t => {
            const tr = document.createElement('tr');
            tr.id = `tr-${t.id}`;
            tr.className = `${t.isStarred ? 'task-starred' : ''} ${this.selectedTaskId === String(t.id) ? 'task-selected' : ''}`.trim();
            tr.dataset.taskRow = String(t.id);
            
            const colorHex = this.getColor(t.assignee);
            
            tr.addEventListener('click', (e) => {
                // Ignore clicks on buttons to prevent bubbling collision
                if (e.target.closest('select, input, button, .status-control, .inline-date-picker, .custom-checkbox, .action-buttons, a, .btn-star')) {
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
            
            let statusButtons;
            if (t.status === 'Entregado') {
                statusButtons = `<div class="status-control status-control-completed" role="group" aria-label="Estado de ${escapeHTML(t.name)}">
                    <span class="status-completed" role="status"><i data-lucide="check-circle-2" aria-hidden="true"></i><span>Entregada</span></span>
                    <button type="button" class="status-option status-reopen" data-action="request-adjustment" data-task-id="${escapeHTML(t.id)}" aria-pressed="false" title="Registrar un ajuste solicitado por el solicitante">
                        <i data-lucide="rotate-ccw" aria-hidden="true"></i><span>Solicitar ajuste</span>
                    </button>
                </div>`;
            } else if (t.status === 'Ajuste solicitado') {
                statusButtons = `<div class="status-control status-control-adjustment" role="group" aria-label="Ajuste solicitado para ${escapeHTML(t.name)}">
                    <span class="status-adjustment" role="status"><i data-lucide="message-square-warning" aria-hidden="true"></i><span>Ajuste solicitado</span></span>
                    <button type="button" class="status-option status-start-adjustment" data-action="start-adjustment" data-task-id="${escapeHTML(t.id)}" title="Iniciar el trabajo sobre el ajuste solicitado">
                        <i data-lucide="play" aria-hidden="true"></i><span>Iniciar ajuste</span>
                    </button>
                </div>`;
            } else {
                statusButtons = `<div class="status-control" role="group" aria-label="Estado de ${escapeHTML(t.name)}">
                    <button type="button" class="status-option status-queue ${t.status === 'En cola' ? 'is-active' : ''}" data-action="set-status" data-status="En cola" data-task-id="${escapeHTML(t.id)}" aria-pressed="${t.status === 'En cola'}">
                        <i data-lucide="pause-circle" aria-hidden="true"></i><span>En cola</span>
                    </button>
                    <button type="button" class="status-option status-progress ${t.status === 'En curso' ? 'is-active' : ''}" data-action="set-status" data-status="En curso" data-task-id="${escapeHTML(t.id)}" aria-pressed="${t.status === 'En curso'}">
                        <i data-lucide="play-circle" aria-hidden="true"></i><span>En curso</span>
                    </button>
                    <button type="button" class="status-option status-done" data-action="set-status" data-status="Entregado" data-task-id="${escapeHTML(t.id)}" aria-pressed="false">
                        <i data-lucide="check-circle-2" aria-hidden="true"></i><span>Entregar</span>
                    </button>
                </div>`;
            }

            tr.innerHTML = `
                <td data-label="Solicitud">
                    <div class="req-title-cell">
                        <strong>
                            <button type="button" class="btn-star ${t.isStarred ? 'active' : ''}" data-action="toggle-star" data-task-id="${escapeHTML(t.id)}" aria-label="${t.isStarred ? 'Quitar prioridad' : 'Marcar como prioridad'}">
                                <i data-lucide="star" aria-hidden="true"></i>
                            </button>
                            <span class="req-title-text" title="${escapeHTML(t.name)}">${escapeHTML(t.name)}</span>
                        </strong>
                        <span>${escapeHTML(t.requester)}</span>
                        ${(() => { const lc = this.getTaskLifecycle(t); return lc.deliveries || lc.adjustments ? `<span class="task-lifecycle-meta">${lc.deliveries} entrega${lc.deliveries === 1 ? '' : 's'} · ${lc.adjustments} ajuste${lc.adjustments === 1 ? '' : 's'}</span>` : ''; })()}
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
                <td class="status-cell" data-label="Estado">${statusButtons}</td>
                <td class="actions-cell" data-label="Acciones">
                    <div class="action-buttons">
                        <button type="button" class="btn-icon task-notes-button ${t.notes ? 'has-notes' : ''}" aria-label="${t.notes ? 'Ver notas de la solicitud' : 'Ver notas de la solicitud (sin notas)'}" title="${t.notes ? 'Ver notas' : 'Sin notas'}" data-action="view-task-notes" data-task-id="${escapeHTML(t.id)}"><i data-lucide="message-square-text" aria-hidden="true"></i>${t.notes ? '<span class="task-notes-dot" aria-hidden="true"></span>' : ''}</button>
                        <button type="button" class="btn-icon edit" aria-label="Editar tarea" title="Editar tarea" data-action="edit-task" data-task-id="${escapeHTML(t.id)}"><i data-lucide="edit-3" aria-hidden="true"></i></button>
                        <button type="button" class="btn-icon delete" aria-label="Eliminar tarea" title="Eliminar tarea" data-action="delete-task" data-task-id="${escapeHTML(t.id)}"><i data-lucide="trash-2" aria-hidden="true"></i></button>
                    </div>
                </td>
            `;
            activeFragment.appendChild(tr);
        });
        if (boardTasks.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.style.cssText = 'text-align:center; padding:40px; color:var(--text-muted);';
            cell.textContent = fCompletion === 'Realizadas'
                ? 'No hay tareas realizadas.'
                : fCompletion === 'Todas'
                    ? 'No hay tareas que coincidan con los filtros.'
                    : 'No hay tareas pendientes.';
            row.appendChild(cell);
            activeFragment.appendChild(row);
        }
        tBody.replaceChildren(activeFragment);

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
                
                if (dateReceived && isDateBefore(dateStr, dateReceived)) {
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
    catch(e) { console.error("FATAL ERROR:", e); alert("No pudimos cargar Design Hub correctamente. Recarga la página. Si el problema continúa, informa al administrador."); }
});