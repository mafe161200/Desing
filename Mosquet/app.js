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
const normalizeAssignees = (value) => {
    const names = Array.isArray(value)
        ? value.map(normalizeText)
        : normalizeText(value).split(/\s*,\s*/).map(normalizeText);
    return [...new Set(names.filter(name => name && name !== 'No asignado'))].slice(0, 3);
};

const serializeAssignees = (value) => {
    const names = normalizeAssignees(value);
    return names.length ? names.join(', ') : 'No asignado';
};

const getPriorityProfile = (task) => {
    const actor = normalizeText(task?.priorityBy);
    if (!actor) return null;

    const actorClean = actor.toLowerCase();
    const profiles = Array.isArray(App.usersList) ? App.usersList : [];
    const currentUser = App.user || null;

    return profiles.find((user) => {
        const name = normalizeText(user?.name).toLowerCase();
        const username = normalizeText(user?.username).toLowerCase();
        const id = normalizeText(user?.id).toLowerCase();
        return actorClean === name || actorClean === username || actorClean === id;
    }) || (currentUser && (
        actorClean === normalizeText(currentUser.name).toLowerCase() ||
        actorClean === normalizeText(currentUser.username).toLowerCase() ||
        actorClean === normalizeText(currentUser.id).toLowerCase()
    ) ? currentUser : null);
};

const getPriorityActor = (task) => {
    const rawActor = normalizeText(task?.priorityBy);
    if (!rawActor) return '';
    const profile = getPriorityProfile(task);
    return normalizeText(profile?.name || rawActor);
};

const getPriorityColor = (task) => {
    const profile = getPriorityProfile(task);
    return profile?.theme || App.getColor(getPriorityActor(task) || 'Prioridad');
};

const isTaskActive = (task) => normalizeText(task?.status) !== 'Entregado';

const taskHasAssignee = (task, name) =>
    normalizeAssignees(task?.assignee).includes(normalizeText(name));


// Normaliza una tarea recibida desde Supabase/Realtime. Mantiene los campos
// opcionales de control de concurrencia cuando la base de datos ya dispone
// de ellos, sin romper instalaciones anteriores de Design Hub.
const normalizeTask = (task) => {
    const source = task && typeof task === 'object' ? task : {};
    const normalized = {
        ...source,
        id: source.id ?? createId(),
        name: normalizeText(source.name),
        requester: normalizeText(source.requester),
        assignee: serializeAssignees(source.assignee),
        status: normalizeText(source.status) || 'En cola',
        dateReceived: normalizeText(source.dateReceived),
        dateDelivered: normalizeText(source.dateDelivered),
        isStarred: Boolean(source.isStarred),
        priorityBy: normalizeText(source.priorityBy || source.priority_by),
        notes: normalizeText(source.notes)
    };
    if (!normalized.dateDelivered && source.due_at) {
        normalized.dateDelivered = String(source.due_at).slice(0, 10);
    }
    if (source.version !== undefined && source.version !== null) normalized.version = Number(source.version) || 1;
    if (source.updated_at !== undefined) normalized.updated_at = source.updated_at;
    if (source.updated_by !== undefined) normalized.updated_by = source.updated_by;
    return normalized;
};

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

const getTaskDeadline = (task) => {
    if (!task) return '';
    return normalizeText(task.due_at).slice(0, 10) || normalizeText(task.dateDelivered);
};

const getTaskDeliveredDate = (task) => {
    if (!task) return '';
    return normalizeText(task.delivered_at).slice(0, 10) || (task.status === 'Entregado' ? normalizeText(task.dateDelivered) : '');
};

const getTaskBoardDate = (task) => task?.status === 'Entregado' ? getTaskDeliveredDate(task) : getTaskDeadline(task);

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

    static buttonFeedback(button, mode = 'success') {
        if (!(button instanceof HTMLElement)) return;
        button.classList.remove('is-feedback-success', 'is-feedback-active');
        void button.offsetWidth;
        button.classList.add(mode === 'active' ? 'is-feedback-active' : 'is-feedback-success');
        window.setTimeout(() => {
            button.classList.remove('is-feedback-success', 'is-feedback-active');
        }, mode === 'active' ? 520 : 680);
    }

    static animateView(viewEl) {
        if (!(viewEl instanceof HTMLElement)) return;
        viewEl.classList.remove('dh-view-enter');
        void viewEl.offsetWidth;
        viewEl.classList.add('dh-view-enter');
        window.setTimeout(() => viewEl.classList.remove('dh-view-enter'), 420);
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
            txt.textContent = 'Sin conexión';
            if (errMessage) console.error("Conexión rechazada:", errMessage);
        }
    }
}

// ----------------------------------------------------------------------
// GESTOR GLOBAL DE MODALES / FOCO
// ----------------------------------------------------------------------
const ModalManager = {
    initialized: false,
    states: new WeakMap(),

    init() {
        if (this.initialized || !document.body) return;
        this.initialized = true;

        const captureState = (overlay) => {
            if (this.states.has(overlay)) return;
            const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            this.states.set(overlay, { previousFocus });
            window.requestAnimationFrame(() => {
                if (!overlay.classList.contains('active')) return;
                const focusable = this.getFocusable(overlay);
                (focusable[0] || overlay.querySelector('.modal-content') || overlay).focus?.({ preventScroll: true });
            });
        };

        const observer = new MutationObserver((records) => {
            records.forEach(record => {
                if (record.type !== 'attributes' || record.attributeName !== 'class') return;
                const overlay = record.target;
                if (!(overlay instanceof HTMLElement) || !overlay.classList.contains('modal-overlay')) return;
                const wasActive = record.oldValue?.includes('active');
                const isActive = overlay.classList.contains('active');
                if (!wasActive && isActive) captureState(overlay);
                if (wasActive && !isActive) {
                    const state = this.states.get(overlay);
                    this.states.delete(overlay);
                    if (state?.previousFocus?.isConnected) state.previousFocus.focus({ preventScroll: true });
                }
            });
        });
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab') return;
            const overlays = [...document.querySelectorAll('.modal-overlay.active')];
            const overlay = overlays.at(-1);
            if (!overlay) return;
            const focusable = this.getFocusable(overlay);
            if (!focusable.length) { event.preventDefault(); return; }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }, true);
    },

    getFocusable(root) {
        return [...root.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
            .filter(el => el.offsetParent !== null || el === document.activeElement);
    }
};

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

        const myPendingTasks = tasks.filter(t => taskHasAssignee(t, userName) && t.status !== 'Entregado' && getTaskDeadline(t));
        if (myPendingTasks.length > 0) {
            myPendingTasks.sort((a, b) => new Date(getTaskDeadline(a) + 'T12:00:00').getTime() - new Date(getTaskDeadline(b) + 'T12:00:00').getTime());
            const nearest = myPendingTasks[0];
            const callback = () => highlightTask(nearest.id);
            
            if (getTaskDeadline(nearest) < todayStr) {
                 setTimeout(() => UI.showToast(`¡Tienes una tarea vencida!: ${nearest.name}`, 'error', 8000, callback, true), 1000);
            } else if (getTaskDeadline(nearest) === todayStr) {
                 setTimeout(() => UI.showToast(`Tu tarea más próxima es para hoy: ${nearest.name}`, 'warning', 8000, callback), 1000);
            } else {
                 setTimeout(() => UI.showToast(`Próxima fecha límite: ${nearest.name} el ${getTaskDeadline(nearest).split('-').reverse().join('/')}`, 'info', 8000, callback), 1000);
            }
        }

        const unassigned = tasks.filter(t => normalizeAssignees(t.assignee).length === 0 && t.status !== 'Entregado' && t.dateReceived);
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

/* =========================================================
   DESIGN HUB V35 — DOMAIN RULES
   ========================================================= */
const TASK_STATUS = Object.freeze({
    QUEUED: 'En cola',
    IN_PROGRESS: 'En curso',
    ADJUSTMENT: 'Ajuste solicitado',
    DELIVERED: 'Entregado'
});

const TASK_STATUS_TRANSITIONS = Object.freeze({
    [TASK_STATUS.QUEUED]: Object.freeze([TASK_STATUS.IN_PROGRESS]),
    [TASK_STATUS.IN_PROGRESS]: Object.freeze([TASK_STATUS.DELIVERED, TASK_STATUS.QUEUED]),
    [TASK_STATUS.ADJUSTMENT]: Object.freeze([TASK_STATUS.IN_PROGRESS]),
    [TASK_STATUS.DELIVERED]: Object.freeze([TASK_STATUS.ADJUSTMENT, TASK_STATUS.IN_PROGRESS, TASK_STATUS.QUEUED])
});

const TASK_EVENT = Object.freeze({
    CREATED: 'CREATED',
    ASSIGNED: 'ASSIGNED',
    STARTED: 'STARTED',
    DELIVERED: 'DELIVERED',
    ADJUSTMENT_REQUESTED: 'ADJUSTMENT_REQUESTED',
    ADJUSTMENT_STARTED: 'ADJUSTMENT_STARTED',
    UPDATED: 'UPDATED',
    RESTORED: 'RESTORED',
    DELETED: 'DELETED'
});

function canTransitionTaskStatus(fromStatus, toStatus) {
    if (!fromStatus || !toStatus || fromStatus === toStatus) return false;
    return (TASK_STATUS_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function getTaskStatusLabel(status) {
    return Object.values(TASK_STATUS).includes(status) ? status : TASK_STATUS.QUEUED;
}

const DataService = {
    async getUsers() {
        if (!supabaseClient) {
            console.error('Supabase no está disponible. No se cargarán perfiles locales.');
            return [];
        }

        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id, username, name, role, avatar, theme, created_at')
                .order('username', { ascending: true });

            if (error) {
                console.error('Supabase: no se pudieron cargar los perfiles.', error);
                UI.showToast('No se pudieron cargar los perfiles del equipo.', 'error');
                return [];
            }

            return (data || []).map(profile => ({
                id: profile.id,
                username: normalizeUsername(profile.username),
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
                .select('id, username, name, role, avatar, theme, created_at')
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

    async getTaskSchemaCapabilities() {
        // The current production schema uses the legacy tasks shape. Modern
        // columns are detected from the actual rows returned by select('*'),
        // so a missing column never blocks the whole workspace.
        if (!supabaseClient) return { modern: false, legacy: true };
        if (this.taskSchemaCapabilities) return this.taskSchemaCapabilities;
        try {
            const { data, error } = await supabaseClient
                .from('tasks')
                .select('*')
                .limit(1);
            if (error) throw error;
            const first = Array.isArray(data) && data.length ? data[0] : {};
            let priorityBy = Object.prototype.hasOwnProperty.call(first, 'priority_by') || Object.prototype.hasOwnProperty.call(first, 'priorityBy');
            if (!priorityBy) {
                const probe = await supabaseClient.from('tasks').select('priority_by').limit(1);
                priorityBy = !probe.error;
            }
            this.taskSchemaCapabilities = {
                modern: ['due_at', 'delivered_at', 'version', 'updated_at'].every(field => Object.prototype.hasOwnProperty.call(first, field)),
                priorityBy,
                legacy: true
            };
            return this.taskSchemaCapabilities;
        } catch (error) {
            this.taskSchemaCapabilities = { modern: false, legacy: true, error: error?.message || 'Error consultando esquema' };
            return this.taskSchemaCapabilities;
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
                throw error;
            }

            UI.updateConnectionStatus(true);
            const rows = Array.isArray(data) ? data : [];
            if (rows.length) {
                const first = rows[0] || {};
                this.taskSchemaCapabilities = {
                    modern: ['due_at', 'delivered_at', 'version', 'updated_at'].every(field => Object.prototype.hasOwnProperty.call(first, field)),
                    priorityBy: Object.prototype.hasOwnProperty.call(first, 'priority_by') || Object.prototype.hasOwnProperty.call(first, 'priorityBy')
                };
            } else if (!this.taskSchemaCapabilities) {
                await this.getTaskSchemaCapabilities();
            }
            return rows.map(normalizeTask);
        } catch (error) {
            UI.updateConnectionStatus(false, error.message);
            console.error('Supabase: error cargando tareas.', error);
            throw error;
        }
    },

    async saveTaskPriority(task) {
        if (!supabaseClient || !task?.id) {
            return { cloudSaved: false, error: new Error('Supabase no está disponible.') };
        }

        const priorityBy = task.isStarred ? normalizeText(task.priorityBy) : null;

        try {
            // La prioridad se guarda de forma aislada. No usamos el payload
            // completo de la tarea ni .select(), para que un cambio de estrella
            // no dependa de permisos de lectura posteriores al UPDATE.
            const { error, count } = await supabaseClient
                .from('tasks')
                .update({
                    isStarred: Boolean(task.isStarred),
                    priority_by: priorityBy
                }, { count: 'exact' })
                .eq('id', task.id);

            if (error) throw error;
            if (count !== null && count !== 1) {
                throw new Error('Supabase no actualizó la solicitud. Verifica los permisos de actualización (RLS) de la tabla tasks.');
            }

            UI.updateConnectionStatus(true);
            return { cloudSaved: true };
        } catch (error) {
            console.error('Supabase: no se pudo guardar la prioridad.', error);
            UI.updateConnectionStatus(false, error.message);
            return { cloudSaved: false, error };
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
        if (this.taskSchemaCapabilities?.priorityBy) fields.push('priorityBy');
        const modernFields = ['assignee_id', 'requester_id', 'due_at', 'delivered_at'];
        if (this.taskSchemaCapabilities?.modern) fields.push(...modernFields);
        const buildPayload = (task) => {
            const payload = { id: task.id };
            fields.forEach(field => {
                const value = task[field];
                const dbField = field === 'priorityBy' ? 'priority_by' : field;
                const optional = ['assignee_id','requester_id','due_at','delivered_at','priorityBy'].includes(field);
                if (optional && value === undefined) return;
                if (optional && value === null) {
                    payload[dbField] = null;
                    return;
                }
                payload[dbField] = value ?? (field === 'isStarred' ? false : '');
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
                const oldTask = byId.get(String(task.id));
                let query = supabaseClient
                    .from('tasks')
                    .update(buildPayload(task))
                    .eq('id', task.id);

                // Si la tabla ya tiene version, la actualización queda protegida
                // contra sobrescrituras entre usuarios. En instalaciones V33 sin
                // esta columna, se conserva el comportamiento anterior.
                const hasVersion = oldTask?.version !== undefined && oldTask?.version !== null;
                if (hasVersion) query = query.eq('version', Number(oldTask.version));

                const { data, error } = await query.select(hasVersion ? 'id, version, updated_at' : 'id');
                if (error) throw error;
                if (!data || data.length !== 1) {
                    const conflict = new Error(`La tarea ${task.id} cambió en otra sesión antes de guardar.`);
                    conflict.code = 'DH_CONFLICT';
                    throw conflict;
                }
            }

            for (const task of deleted) {
                const oldTask = byId.get(String(task.id));
                let query = supabaseClient
                    .from('tasks')
                    .delete()
                    .eq('id', task.id);
                const hasVersion = oldTask?.version !== undefined && oldTask?.version !== null;
                if (hasVersion) query = query.eq('version', Number(oldTask.version));

                const { data, error } = await query.select('id');
                if (error) throw error;
                if (!data || data.length !== 1) {
                    const conflict = new Error(`La tarea ${task.id} cambió en otra sesión antes de eliminarse.`);
                    conflict.code = 'DH_CONFLICT';
                    throw conflict;
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

    async getChangeHistory(limit = 300, offset = 0) {
        if (!supabaseClient) return [];
        try {
            const safeLimit = Math.max(1, Math.min(Number(limit) || 300, 1000));
            const safeOffset = Math.max(0, Number(offset) || 0);
            const { data, error } = await supabaseClient
                .from('task_change_history')
                .select('id, task_id, operation, before_data, after_data, changed_by, created_at')
                .order('created_at', { ascending: false })
                .range(safeOffset, safeOffset + safeLimit - 1);
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

    async getTaskChangeHistory(taskId, limit = 1000) {
        if (!supabaseClient || !taskId) return [];
        try {
            const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 2000));
            const { data, error } = await supabaseClient
                .from('task_change_history')
                .select('id, task_id, operation, before_data, after_data, changed_by, created_at')
                .eq('task_id', taskId)
                .order('created_at', { ascending: true })
                .limit(safeLimit);
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Supabase: no se pudo cargar la trazabilidad de la solicitud.', error);
            return [];
        }
    },

    async restoreTaskVersion(taskId, snapshot, expectedVersion = null) {
        if (!supabaseClient || !taskId || !snapshot) return { cloudSaved: false };

        try {
            const expectedVersion = Number(expectedVersion ?? snapshot.version);
            const canUseOptimisticRestore = Number.isFinite(expectedVersion) && expectedVersion > 0;

            // V36: la restauración debe respetar concurrencia optimista.
            // La RPC aplica UPDATE ... WHERE id AND version dentro de PostgreSQL,
            // evitando sobrescribir cambios hechos por otra sesión.
            if (canUseOptimisticRestore) {
                const { data, error } = await supabaseClient.rpc('design_hub_restore_task', {
                    p_task_id: String(taskId),
                    p_expected_version: expectedVersion,
                    p_name: snapshot.name ?? '',
                    p_requester: snapshot.requester ?? '',
                    p_assignee: snapshot.assignee ?? 'No asignado',
                    p_status: snapshot.status ?? 'En cola',
                    p_date_received: snapshot.dateReceived ?? '',
                    p_date_delivered: snapshot.dateDelivered ?? '',
                    p_notes: snapshot.notes ?? ''
                });

                if (error) throw error;
                return { cloudSaved: Array.isArray(data) ? data.length === 1 : Boolean(data), data };
            }

            // Compatibilidad temporal con instalaciones antiguas que todavía no
            // tienen version. No se usa cuando la tarea ya expone version.
            const payload = {
                name: snapshot.name ?? '',
                requester: snapshot.requester ?? '',
                assignee: snapshot.assignee ?? 'No asignado',
                status: snapshot.status ?? 'En cola',
                dateReceived: snapshot.dateReceived ?? '',
                dateDelivered: snapshot.dateDelivered ?? '',
                isStarred: Boolean(snapshot.isStarred),
                notes: snapshot.notes ?? ''
            };
            const { data, error } = await supabaseClient
                .from('tasks')
                .update(payload)
                .eq('id', taskId)
                .select('id')
                .single();
            if (error) throw error;
            return { cloudSaved: Boolean(data), data };
        } catch (error) {
            const result = { cloudSaved: false, error };
            if (error?.code === 'P0001' || String(error?.message || '').includes('DH_CONFLICT')) {
                const conflict = new Error('La tarea cambió en otra sesión antes de restaurar esta versión.');
                conflict.code = 'DH_CONFLICT';
                return { ...result, error: conflict };
            }
            console.error('Supabase: no se pudo restaurar la versión.', error);
            return result;
        }
    },

    async recordTaskEvent(event) {
        if (!supabaseClient || !event?.task_id || !event?.type) {
            return { cloudSaved: false, reason: 'missing-client-or-event' };
        }
        try {
            const { data, error } = await supabaseClient
                .from('task_events')
                .insert({
                    task_id: event.task_id,
                    type: event.type,
                    reason: event.reason ?? null,
                    actor_id: event.actor_id ?? null,
                    metadata: event.metadata ?? {}
                })
                .select('id')
                .single();
            if (error) throw error;
            return { cloudSaved: Boolean(data), data };
        } catch (error) {
            console.warn('Supabase: task_events no está disponible todavía.', error);
            return { cloudSaved: false, error };
        }
    },

    async getNotes() {
        if (!supabaseClient) return [];

        try {
            const { data, error } = await supabaseClient
                .from('notes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('Supabase: no se pudieron cargar las notas.', error);
                return [];
            }

            return Array.isArray(data) ? data.reverse() : [];
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
    // Los selectores se reconstruyen como un conjunto único. Si se reconstruye
    // un formulario después de los filtros, nunca anidamos wrappers anteriores.
    // Esto evita que los dropdowns de Nueva solicitud queden desconectados.
    const root = document;
    root.querySelectorAll('.select-wrapper').forEach(w => {
        const select = w.querySelector('select');
        if (select) { w.parentNode.insertBefore(select, w); select.style.display = ''; }
        w.remove();
    });
    document.querySelectorAll('.select-options-portal').forEach(menu => menu.remove());

    if (!window.__designHubSelectDismissBound) {
        document.addEventListener('click', (event) => {
            if (event.target.closest('.select-trigger') || event.target.closest('.select-options')) return;
            document.querySelectorAll('.select-options.open').forEach(menu => menu.classList.remove('open'));
            document.querySelectorAll('.select-trigger.active').forEach(trigger => {
                trigger.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
            });
        });
        window.__designHubSelectDismissBound = true;
    }

    const closeAll = (except = null) => {
        document.querySelectorAll('.select-options.open').forEach(menu => {
            if (menu !== except) menu.classList.remove('open');
        });
        document.querySelectorAll('.select-trigger.active').forEach(trigger => {
            if (except?.dataset.triggerId !== trigger.id) {
                trigger.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    };

    const positionPortal = (trigger, menu) => {
        const rect = trigger.getBoundingClientRect();
        const margin = 6;
        const viewportPadding = 8;
        const estimatedHeight = Math.min(menu.scrollHeight || 220, 220);
        const openAbove = window.innerHeight - rect.bottom < estimatedHeight + margin + viewportPadding;
        const top = openAbove
            ? Math.max(viewportPadding, rect.top - Math.min(estimatedHeight, 220) - margin)
            : Math.min(window.innerHeight - viewportPadding - Math.min(estimatedHeight, 220), rect.bottom + margin);
        const maxWidth = Math.max(120, Math.min(rect.width, window.innerWidth - viewportPadding * 2));
        const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - maxWidth - viewportPadding);
        menu.style.position = 'fixed';
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.bottom = 'auto';
        menu.style.width = `${rect.width}px`;
        menu.style.maxHeight = `${Math.max(120, Math.min(220, openAbove ? rect.top - margin - viewportPadding : window.innerHeight - rect.bottom - margin - viewportPadding))}px`;
    };

    root.querySelectorAll('select.native-select-hidden').forEach(select => {
        const wrapper = document.createElement('div');
        wrapper.className = 'select-wrapper';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        const trigger = document.createElement('div');
        const triggerId = `select-trigger-${createId()}`;
        const optionsId = `select-options-${createId()}`;
        trigger.id = triggerId;
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', optionsId);
        trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.name || select.id || 'Selector');

        const classNames = Array.from(select.classList).filter(c => c !== 'native-select-hidden').join(' ');
        trigger.className = `select-trigger ${classNames}`;

        const safeText = escapeHTML(
            select.multiple
                ? (Array.from(select.selectedOptions).map(option => option.text).join(', ') ||
                    (select.id === 'assignee' ? 'Selecciona hasta 3 personas' : 'No asignado'))
                : (select.options[select.selectedIndex]?.text || '')
        );
        trigger.innerHTML = `<span>${safeText}</span> <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

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
        optionsDiv.id = optionsId;
        optionsDiv.className = 'select-options';
        optionsDiv.setAttribute('role', 'listbox');
        optionsDiv.setAttribute('aria-label', trigger.getAttribute('aria-label'));
        optionsDiv.dataset.triggerId = triggerId;
        optionsDiv.dataset.selectId = select.id;
        if (select.classList.contains('multi-assignee-select')) {
            optionsDiv.classList.add('multi-assignee-options');
        }

        // Todos los selectores personalizados se portan al body. Así funcionan
        // igual dentro de modales, tablas y paneles con overflow/scroll, sin quedar
        // recortados por contenedores padres.
        const shouldPortal = true;
        if (shouldPortal) {
            optionsDiv.classList.add('select-options-portal');
            document.body.appendChild(optionsDiv);
        }

        const optionElements = [];
        const focusOption = (index) => {
            const options = optionElements.filter(Boolean);
            if (!options.length) return;
            const nextIndex = Math.max(0, Math.min(index, options.length - 1));
            options[nextIndex].focus();
        };

        const isMultiAssignee = select.classList.contains('multi-assignee-select');

        Array.from(select.options).forEach((opt, index) => {
            const item = document.createElement('div');
            item.className = `select-option ${opt.selected ? 'selected' : ''}`;
            if (select.classList.contains('multi-assignee-select')) {
                item.innerHTML = `<span class="multi-option-check" aria-hidden="true">✓</span><span>${escapeHTML(opt.text)}</span>`;
            } else {
                item.textContent = opt.text;
            }
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
            item.setAttribute('tabindex', '-1');
            item.dataset.index = String(index);

            const handleSelect = (e) => {
                e.stopPropagation();
                if (opt.disabled) return;
                if (isMultiAssignee) {
                    const selected = Array.from(select.selectedOptions).map(option => option.value);
                    let nextSelected;

                    if (opt.value === 'No asignado') {
                        nextSelected = opt.selected ? [] : ['No asignado'];
                    } else {
                        const withoutUnassigned = selected.filter(value => value !== 'No asignado');
                        nextSelected = opt.selected
                            ? withoutUnassigned.filter(value => value !== opt.value)
                            : [...withoutUnassigned, opt.value];
                    }

                    if (opt.value !== 'No asignado' && !opt.selected && nextSelected.length > 3) {
                        UI.showToast('Puedes asignar máximo 3 personas.', 'info');
                        return;
                    }

                    Array.from(select.options).forEach(option => {
                        option.selected = nextSelected.includes(option.value);
                    });

                    const labels = Array.from(select.selectedOptions).map(option => option.text);
                    trigger.querySelector('span').textContent = labels.length ? labels.join(', ') : 'No asignado';

                    optionElements.forEach((optionEl, optionIndex) => {
                        const sourceOption = select.options[optionIndex];
                        const isSelected = !!sourceOption?.selected;
                        optionEl.classList.toggle('selected', isSelected);
                        optionEl.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                    });

                    if (select.classList.contains('inline-assignee')) {
                        const colorName = labels[0] || 'No asignado';
                        const newColor = App.getColor(colorName);
                        select.setAttribute('data-color', newColor);
                        applyColor(newColor);
                    }

                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }

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
                trigger.setAttribute('aria-expanded', 'false');
                optionElements.forEach(c => c?.setAttribute('aria-selected', 'false'));
                optionElements.forEach(c => c?.classList.remove('selected'));
                item.classList.add('selected');
                item.setAttribute('aria-selected', 'true');
                trigger.focus();
            };

            item.addEventListener('click', handleSelect);
            item.addEventListener('keydown', (e) => {
                const currentIndex = Number(item.dataset.index);
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(e); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); focusOption(currentIndex + 1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); focusOption(currentIndex - 1); }
                else if (e.key === 'Home') { e.preventDefault(); focusOption(0); }
                else if (e.key === 'End') { e.preventDefault(); focusOption(optionElements.length - 1); }
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    optionsDiv.classList.remove('open');
                    trigger.classList.remove('active');
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.focus();
                }
            });
            optionElements.push(item);
            optionsDiv.appendChild(item);
        });

        const toggleDropdown = (e) => {
            e.stopPropagation();
            const isOpen = optionsDiv.classList.contains('open');
            closeAll(optionsDiv);
            if (isOpen) {
                optionsDiv.classList.remove('open');
                trigger.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
                return;
            }
            if (shouldPortal) positionPortal(trigger, optionsDiv);
            optionsDiv.classList.add('open');
            trigger.classList.add('active');
            trigger.setAttribute('aria-expanded', 'true');
            const selectedIndex = Array.from(select.options).findIndex(option => option.value === select.value);
            const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
            window.requestAnimationFrame(() => focusOption(targetIndex));
        };

        trigger.addEventListener('click', toggleDropdown);
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                toggleDropdown(e);
            } else if (e.key === 'Escape' && trigger.classList.contains('active')) {
                e.preventDefault();
                optionsDiv.classList.remove('open');
                trigger.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });

        wrapper.appendChild(trigger);
    });
    lucide.createIcons();
}

function updateCustomSelectUI(selectElement, value) {
    if (selectElement?.multiple) {
        const names = normalizeAssignees(value);
        Array.from(selectElement.options).forEach(option => {
            option.selected = names.includes(option.value);
        });

        const wrapper = selectElement.closest('.select-wrapper');
        const triggerSpan = wrapper?.querySelector('.select-trigger span');
        if (triggerSpan) triggerSpan.textContent = names.length ? names.join(', ') : 'No asignado';

        const options = document.querySelectorAll(
            `.select-options-portal[data-select-id="${CSS.escape(selectElement.id)}"] .select-option`
        );
        options.forEach((opt, index) => {
            const selected = !!selectElement.options[index]?.selected;
            opt.classList.toggle('selected', selected);
            opt.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
        return;
    }

    selectElement.value = value;
    const wrapper = selectElement.closest('.select-wrapper');
    const option = Array.from(selectElement.options).find(o => o.value === value);
    const triggerSpan = wrapper?.querySelector('.select-trigger span');
    if (triggerSpan && option) triggerSpan.textContent = option.text;

    const localOptions = wrapper?.querySelectorAll('.select-option') || [];
    const portalOptions = selectElement.id
        ? document.querySelectorAll(`.select-options-portal[data-select-id="${CSS.escape(selectElement.id)}"] .select-option`)
        : [];
    [...localOptions, ...portalOptions].forEach(opt => {
        const isSelected = opt.textContent === option?.text;
        opt.classList.toggle('selected', isSelected);
        opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
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
    autosaveTimer: null,
    autosaveRevision: 0,
    autosaveLastSnapshot: null,
    autosaveHideTimer: null,
    selectedTaskId: null,
    adjustmentTaskId: null,
    lifecycleRuntime: new Map(),
    pendingLifecycleEvents: [],
    currentView: 'board',
    changeHistory: [],
    changeHistoryPageSize: 300,
    changeHistoryHasMore: false,
    changeHistoryLoading: false,
    changeHistoryLastFocusedElement: null,
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
        ModalManager.init();
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
        this.changeHistory = await DataService.getChangeHistory(this.changeHistoryPageSize, 0);
        this.changeHistoryHasMore = this.changeHistory.length >= this.changeHistoryPageSize;
        this.rebuildLifecycleRuntime();
        this.setupPlugins();
        this.setupKeyboardShortcuts();
        this.setupEventListeners();
        this.setupHistoryView();
        this.setupChangeHistoryView();
        if (!window.__designHubUnsavedGuardBound) {
            window.addEventListener('beforeunload', (event) => {
                if (!this.hasUnsavedChanges) return;
                event.preventDefault();
                event.returnValue = '';
            });
            window.__designHubUnsavedGuardBound = true;
        }
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
                this.changeHistory = await DataService.getChangeHistory(this.changeHistoryPageSize, 0);
                this.changeHistoryHasMore = this.changeHistory.length >= this.changeHistoryPageSize;
                this.rebuildLifecycleRuntime();
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
            onChange: (dates) => { this.filterDates = dates; this.updateAdvancedFiltersSummary(); this.renderBoard(); }
        });
        
        flatpickr(".modal-date", { 
            locale: "es", dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", disableMobile: "true",
            appendTo: document.body,
            onReady: (selectedDates, dateStr, instance) => {
                ensureFlatpickrFormFieldIds(instance, 'modal-date');
            }
        });
    },

    updateAutosaveUI(state = 'saved', message = '') {
        const bar = document.getElementById('unsavedChangesBar');
        const text = document.getElementById('unsavedChangesText');
        const icon = bar?.querySelector('[data-lucide]');
        if (!bar || !text) return;

        if (this.autosaveHideTimer) {
            window.clearTimeout(this.autosaveHideTimer);
            this.autosaveHideTimer = null;
        }

        const labels = {
            pending: 'Guardando automáticamente…',
            saving: 'Sincronizando…',
            saved: message || 'Guardado',
            error: message || 'No se pudo sincronizar',
            conflict: message || 'Hay un cambio remoto que requiere revisión'
        };
        const icons = {
            pending: 'cloud-upload',
            saving: 'loader-circle',
            saved: 'cloud-check',
            error: 'cloud-off',
            conflict: 'triangle-alert'
        };

        text.textContent = labels[state] || labels.saved;
        if (icon) icon.setAttribute('data-lucide', icons[state] || icons.saved);
        bar.dataset.state = state;
        bar.classList.toggle('active', true);
        bar.classList.toggle('is-saved', state === 'saved');
        bar.setAttribute('aria-hidden', 'false');
        bar.setAttribute('inert', '');
        lucide.createIcons();

        if (state === 'saved') {
            this.autosaveHideTimer = window.setTimeout(() => {
                bar.classList.remove('active');
                bar.setAttribute('aria-hidden', 'true');
            }, 2200);
        }
    },

    markAsUnsaved() {
        this.hasUnsavedChanges = true;
        this.autosaveRevision += 1;
        this.updateAutosaveUI('pending');
        if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer);
        this.autosaveTimer = window.setTimeout(() => {
            this.autosaveTimer = null;
            this.saveChanges();
        }, 750);
    },

    async saveChanges() {
        if (this.isSavingChanges || !this.hasUnsavedChanges) return;
        this.isSavingChanges = true;
        const revisionAtStart = this.autosaveRevision;
        const snapshotAtStart = JSON.parse(JSON.stringify(this.tasks));
        this.autosaveLastSnapshot = JSON.parse(JSON.stringify(this.originalTasks));
        this.updateAutosaveUI('saving');

        try {
            const result = await DataService.saveTasks(snapshotAtStart, this.originalTasks);

            if (!result.cloudSaved) {
                if (result.error?.code === 'DH_CONFLICT') {
                    this.updateAutosaveUI('conflict', 'No se guardó: otra persona modificó esta solicitud');
                    UI.showToast('Otra persona modificó una solicitud mientras trabajabas. No se sobrescribieron sus cambios.', 'warning', 9000);
                } else {
                    this.updateAutosaveUI('error', 'No se pudo sincronizar');
                    UI.showToast('No se pudo sincronizar el cambio. Tu información local permanece intacta.', 'error', 9000);
                }
                return;
            }

            await this.flushPendingLifecycleEvents();

            try {
                const freshTasks = await DataService.getTasks();
                // Si el usuario cambió algo mientras guardábamos, no pisamos esos
                // cambios locales con el refresco remoto. El siguiente ciclo los
                // sincronizará automáticamente.
                if (this.autosaveRevision === revisionAtStart) {
                    this.originalTasks = JSON.parse(JSON.stringify(freshTasks));
                    this.tasks = JSON.parse(JSON.stringify(freshTasks));
                    this.hasUnsavedChanges = false;
                    this.updateAutosaveUI('saved');
                    this.renderAll();
                } else {
                    this.originalTasks = JSON.parse(JSON.stringify(freshTasks));
                    this.hasUnsavedChanges = true;
                    this.updateAutosaveUI('pending');
                }
            } catch (refreshError) {
                console.warn('Supabase: cambios guardados, pero no se pudo refrescar la copia local.', refreshError);
                if (this.autosaveRevision === revisionAtStart) {
                    this.originalTasks = JSON.parse(JSON.stringify(snapshotAtStart));
                    this.tasks = JSON.parse(JSON.stringify(snapshotAtStart));
                    this.hasUnsavedChanges = false;
                    this.updateAutosaveUI('saved');
                    this.renderAll();
                }
            }
        } catch (error) {
            console.error('Error inesperado al guardar cambios:', error);
            this.updateAutosaveUI('error', 'No se pudo sincronizar');
            UI.showToast('No se pudo sincronizar el cambio. Tu información local permanece intacta.', 'error', 9000);
        } finally {
            this.isSavingChanges = false;
            if (this.hasUnsavedChanges && this.autosaveRevision > revisionAtStart && !this.autosaveTimer) {
                this.autosaveTimer = window.setTimeout(() => {
                    this.autosaveTimer = null;
                    this.saveChanges();
                }, 350);
            }
        }
    },

    undoChanges() {
        if (!this.autosaveLastSnapshot) return;
        this.tasks = JSON.parse(JSON.stringify(this.autosaveLastSnapshot));
        this.autosaveLastSnapshot = null;
        this.markAsUnsaved();
        this.renderBoard();
        UI.showToast('Último cambio revertido. Se guardará automáticamente.', 'info');
    },

    async toggleTaskStar(taskId) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task || !isTaskActive(task) || task._prioritySaving) return;

        const previousStarred = Boolean(task.isStarred);
        const previousPriorityBy = normalizeText(task.priorityBy);

        task.isStarred = !previousStarred;
        task.priorityBy = task.isStarred
            ? normalizeText(this.user?.username || this.user?.name)
            : '';
        task._prioritySaving = true;

        this.renderBoard();
        this.updateAutosaveUI('saving', 'Guardando prioridad…');

        const result = await DataService.saveTaskPriority(task);
        task._prioritySaving = false;

        if (!result.cloudSaved) {
            task.isStarred = previousStarred;
            task.priorityBy = previousPriorityBy;
            this.renderBoard();
            this.updateAutosaveUI('error', 'No se pudo sincronizar');
            UI.showToast(
                `No se pudo guardar la prioridad. ${result.error?.message || 'Revisa la conexión con Supabase.'}`,
                'error',
                9000
            );
            return;
        }

        // Actualiza la copia sincronizada sin activar el guardado general.
        const synced = this.originalTasks.find(t => String(t.id) === String(task.id));
        if (synced) {
            synced.isStarred = task.isStarred;
            synced.priorityBy = task.priorityBy;
        }
        this.hasUnsavedChanges = false;
        this.updateAutosaveUI('saved', 'Prioridad guardada');
        this.renderBoard();
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
            if (card && ['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                card.click();
                return;
            }
            const workload = event.target.closest?.('[data-workload-filter]');
            if (workload && ['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                workload.click();
            }
        });
    },

    setupEventListeners() {

        const mTask = document.getElementById('modalTask');
        document.getElementById('btnNewTask').addEventListener('click', () => {
            const form = document.getElementById('taskForm');
            if (form) form.reset();

            const requesterSelect = document.getElementById('requesterSelect');
            const assigneeSelect = document.getElementById('assignee');

            if (requesterSelect) updateCustomSelectUI(requesterSelect, '');
            if (assigneeSelect) updateCustomSelectUI(assigneeSelect, []);

            // Recalcula los menús del formulario cada vez que se abre. Esto evita
            // que una renderización previa deje triggers sin opciones o referencias
            // antiguas, especialmente después de actualizar solicitantes/equipo.
            buildCustomSelects(document);
            if (requesterSelect) updateCustomSelectUI(requesterSelect, '');
            if (assigneeSelect) updateCustomSelectUI(assigneeSelect, []);

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

        document.getElementById('btnOpenChangeHistory')?.addEventListener('click', () => {
            this.showView('change-history');
        });
        document.getElementById('boardWorkspaceTab')?.addEventListener('click', () => this.showView('board'));
        document.getElementById('boardWorkspaceRequests')?.addEventListener('click', () => this.showView('history'));
        document.getElementById('boardWorkspaceChanges')?.addEventListener('click', () => this.showView('change-history'));
        document.getElementById('historyTabBoard')?.addEventListener('click', () => this.showView('board'));
        document.getElementById('historyTabBoard')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.showView('board'); }
        });
        document.getElementById('changeHistoryTabBoard')?.addEventListener('click', () => this.showView('board'));
        document.getElementById('btnOpenHistorySidebar')?.addEventListener('click', () => {
            this.showView('history');
        });
        document.getElementById('historyTabRequests')?.addEventListener('click', () => this.showView('history'));
        document.getElementById('historyTabChanges')?.addEventListener('click', () => this.showView('change-history'));
        document.getElementById('changeHistoryTabRequests')?.addEventListener('click', () => this.showView('history'));
        document.getElementById('changeHistoryTabChanges')?.addEventListener('click', () => this.showView('change-history'));

        document.querySelectorAll('.close-modal').forEach(b => {
            if(b.id !== 'closeProfileModalBtn') {
                b.addEventListener('click', e => {
                    const overlay = e.target.closest('.modal-overlay');
                    overlay?.classList.remove('active');
                    if (overlay?.id === 'modalAdjustment') this.adjustmentTaskId = null;
                });
            }
        });

        document.getElementById('confirmDeliveryBtn')?.addEventListener('click', () => {
            const taskId = document.getElementById('modalDeliveryConfirm')?.dataset.taskId;
            if (taskId) this.confirmTaskDelivery(taskId);
        });

        document.getElementById('confirmReopenBtn')?.addEventListener('click', () => {
            const taskId = document.getElementById('modalReopenTask')?.dataset.taskId;
            if (taskId) this.confirmTaskReopen(taskId);
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
            if(el) el.addEventListener('change', () => {
                this.updateAdvancedFiltersSummary();
                this.animateNextBoardRender = 'filter';
                this.renderBoard();
            });
        });

        const taskSearch = document.getElementById('taskSearch');
        if (taskSearch) {
            let searchTimer = null;
            taskSearch.addEventListener('input', () => {
                window.clearTimeout(searchTimer);
                searchTimer = window.setTimeout(() => {
                    this.animateNextBoardRender = 'filter';
                    this.renderBoard();
                }, 120);
            });
        }

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.resetBoardFilters({ keepSort: false });
            this.quickFilter = 'all';
            document.querySelectorAll('.quick-filter').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.quickFilter === 'all');
            });
            this.animateNextBoardRender = 'filter';
            this.renderBoard();
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

            const newTask = {
                id: createId(),
                name: taskNameRaw,
                requester: requesterRaw,
                assignee: serializeAssignees(Array.from(assigneeInput?.selectedOptions || []).map(option => option.value)),
                status: 'En cola',
                dateReceived: dateReceivedValue,
                dateDelivered: delivered,
                isStarred: false,
                notes: normalizeText(document.getElementById('taskNotes')?.value)
            };
            if (DataService.taskSchemaCapabilities?.modern) {
                newTask.due_at = delivered ? `${delivered}T12:00:00` : null;
            }
            this.tasks.push(newTask);

            this.markAsUnsaved();
            taskForm.reset();

            const newRequesterSelect = document.getElementById('requesterSelect');
            const newAssigneeSelect = document.getElementById('assignee');
            if (newRequesterSelect) updateCustomSelectUI(newRequesterSelect, '');
            if (newAssigneeSelect) updateCustomSelectUI(newAssigneeSelect, []);

            const receivedPicker = document.getElementById('dateReceived')?._flatpickr;
            const deliveredPicker = document.getElementById('dateDelivered')?._flatpickr;
            if (receivedPicker) receivedPicker.setDate(dateReceivedValue);
            if (deliveredPicker) deliveredPicker.clear();

            document.getElementById('modalTask')?.classList.remove('active');
            this.renderBoard();
            UI.showToast('Solicitud creada. Se guardará automáticamente.', 'success');
        });

        document.getElementById('editTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const editForm = document.getElementById('editTaskForm');
            const nameInput = document.getElementById('editTaskName');
            const requesterInput = document.getElementById('editRequesterSelect');
            const receivedInput = document.getElementById('editDateReceived');
            const nameRaw = normalizeText(nameInput?.value);
            const requesterRaw = normalizeText(requesterInput?.value);
            const receivedRaw = normalizeText(receivedInput?.value);
            const taskIdInput = document.getElementById('editTaskId');

            nameInput?.setCustomValidity(nameRaw.length < 3 ? 'Escribe un título de al menos 3 caracteres.' : '');
            requesterInput?.setCustomValidity(requesterRaw ? '' : 'Selecciona un solicitante.');
            receivedInput?.setCustomValidity(receivedRaw ? '' : 'Indica la fecha de recepción.');

            if (!editForm.checkValidity()) {
                editForm.reportValidity();
                return;
            }

            const id = taskIdInput.value;
            const task = this.tasks.find(t => t.id === id);
            
            if (task) {
                const newRecDate = normalizeText(document.getElementById('editDateReceived').value);
                
                if (task.dateDelivered && isDateBefore(task.dateDelivered, newRecDate)) {
                    receivedInput.setCustomValidity('La fecha de recepción no puede ser posterior a la fecha de entrega.');
                    editForm.reportValidity();
                    return;
                }
                receivedInput.setCustomValidity('');

                task.name = nameRaw;
                task.requester = requesterRaw;
                task.dateReceived = newRecDate;
                task.notes = normalizeText(document.getElementById('editTaskNotes')?.value);
                
                this.markAsUnsaved();
                document.getElementById('modalEditTask').classList.remove('active');
                UI.showToast("Solicitud editada. Se guardará automáticamente.", "success");
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
            if (!event.target.closest('.row-actions-menu')) {
                document.querySelectorAll('.row-actions-popover').forEach(popover => { popover.hidden = true; });
                document.querySelectorAll('.row-menu-trigger[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
            }

            const quickFilter = event.target.closest('[data-quick-filter]');
            if (quickFilter) {
                this.activateQuickFilter(quickFilter.dataset.quickFilter || 'all');
                return;
            }

            const workloadItem = event.target.closest('[data-workload-filter]');
            if (workloadItem) {
                const assignee = normalizeText(workloadItem.dataset.workloadFilter);
                const select = document.getElementById('filterAssignee');
                if (select && [...select.options].some(option => option.value === assignee)) {
                    this.resetBoardFilters();
                    updateCustomSelectUI(select, assignee);
                    const advanced = document.querySelector('.advanced-task-filters');
                    if (advanced) advanced.open = true;
                    this.quickFilter = 'all';
                    document.querySelectorAll('.quick-filter').forEach(btn => btn.classList.toggle('active', btn.dataset.quickFilter === 'all'));
                    this.renderBoard();
                    UI.showToast(`Mostrando tareas de ${assignee}`, 'info');
                }
                return;
            }

            const summaryCard = event.target.closest('[data-summary]');
            if (summaryCard && summaryCard.classList.contains('is-interactive')) {
                const map = { total: 'all', course: 'course', queue: 'queue', adjustment: 'adjustment', overdue: 'overdue', starred: 'starred' };
                this.activateQuickFilter(map[summaryCard.dataset.summary] || 'all');
                return;
            }

            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const taskId = target.dataset.taskId;

            if (action === 'toggle-row-menu') {
                const menu = target.closest('.row-actions-menu')?.querySelector('.row-actions-popover');
                const isOpen = Boolean(menu && !menu.hidden);
                document.querySelectorAll('.row-actions-popover').forEach(popover => { popover.hidden = true; });
                document.querySelectorAll('.row-menu-trigger[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
                if (menu && !isOpen) {
                    menu.hidden = false;
                    target.setAttribute('aria-expanded', 'true');
                }
                return;
            }

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
                        this.handleTaskStatusAction(taskId, target.dataset.status, target);
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

                case 'view-task-history':
                    if (taskId) this.openTaskTimeline(taskId, target);
                    break;

                case 'edit-task':
                    if (taskId) {
                        this.openEditModal(taskId);
                    }
                    break;

                case 'delete-task':
                    if (taskId) this.openDeleteConfirmation(taskId, target);
                    break;

                case 'reopen-task':
                    if (taskId) this.openReopenConfirmation(taskId, target);
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
                        serializeAssignees(Array.from(target.selectedOptions || []).map(option => option.value)),
                        false
                    );
                    break;

                case 'set-status': {
                    const selectedStatus = target.dataset.status;
                    const currentStatus = this.tasks.find(t => String(t.id) === String(taskId))?.status;
                    if (!taskId || !selectedStatus) break;
                    if (selectedStatus === 'Ajuste solicitado') {
                        this.requestTaskAdjustment(taskId);
                    } else if (selectedStatus === 'En curso' && currentStatus === 'Ajuste solicitado') {
                        this.startTaskAdjustment(taskId);
                    } else {
                        this.handleTaskStatusAction(taskId, selectedStatus, target);
                    }
                    break;
                }

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

    recordLifecycleEvent(taskId, type, metadata = {}) {
        const id = String(taskId || '');
        if (!id) return;
        const current = this.lifecycleRuntime.get(id) || { deliveries: 0, adjustments: 0, events: [] };
        if (type === 'delivery') current.deliveries += 1;
        if (type === 'adjustment') current.adjustments += 1;
        current.events = Array.isArray(current.events) ? current.events : [];
        current.events.push({ type, at: new Date().toISOString(), metadata });
        this.lifecycleRuntime.set(id, current);
    },

    queueLifecycleEvent(taskId, type, metadata = {}) {
        const id = String(taskId || '');
        if (!id) return;
        this.pendingLifecycleEvents.push({ task_id: id, type, metadata: { ...metadata } });
    },

    async flushPendingLifecycleEvents() {
        if (!this.pendingLifecycleEvents.length) return;
        const actorId = this.user?.id || this.user?.user_id || null;
        const pending = [...this.pendingLifecycleEvents];
        this.pendingLifecycleEvents = [];
        for (const event of pending) {
            await DataService.recordTaskEvent({
                task_id: event.task_id,
                type: event.type,
                actor_id: actorId,
                metadata: event.metadata
            });
        }
    },

    setTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task) return;

        const normalizedNewStatus = getTaskStatusLabel(newStatus);
        if (!canTransitionTaskStatus(task.status, normalizedNewStatus)) {
            UI.showToast(`No se puede pasar de "${task.status}" a "${normalizedNewStatus}".`, 'warning');
            return false;
        }

        const previousStatus = task.status;
        task.status = normalizedNewStatus;
        task.updatedAt = new Date().toISOString();
        this.selectedTaskId = String(taskId);
        this.recordLifecycleEvent(taskId, 'status', { from: previousStatus, to: normalizedNewStatus });
        this.queueLifecycleEvent(taskId, 'STATUS_CHANGED', { from: previousStatus, to: normalizedNewStatus });
        this.markAsUnsaved();
        this.animateNextBoardRender = 'status';
        this.pendingRowAnimation = { taskId: String(taskId), kind: normalizedNewStatus === TASK_STATUS.DELIVERED ? 'delivered' : 'status' };
        this.renderBoard();
        return true;
    },

    handleTaskStatusAction(taskId, newStatus, sourceButton = null) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task) return;

        if (newStatus === 'Entregado') {
            UI.buttonFeedback(sourceButton, 'active');
            this.openDeliveryConfirmation(taskId, sourceButton);
            return;
        }

        UI.buttonFeedback(sourceButton, 'success');
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

    openDeliveryConfirmation(taskId, sourceButton = null) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        const modal = document.getElementById('modalDeliveryConfirm');
        if (!task || !modal) return;

        const title = document.getElementById('deliveryConfirmTaskTitle');
        const date = document.getElementById('deliveryConfirmDate');
        const assignee = document.getElementById('deliveryConfirmAssignee');
        const confirmButton = document.getElementById('confirmDeliveryBtn');

        if (title) title.textContent = normalizeText(task.name);
        if (date) date.textContent = 'Se registrará hoy como fecha real de entrega';
        if (assignee) assignee.textContent = normalizeAssignees(task.assignee).join(', ') || 'No asignado';

        modal.dataset.taskId = String(taskId);
        if (sourceButton instanceof HTMLElement && sourceButton.id) {
            modal.dataset.sourceButtonId = sourceButton.id;
        } else {
            delete modal.dataset.sourceButtonId;
        }
        if (confirmButton) confirmButton.dataset.taskId = String(taskId);
        modal.classList.add('active');
        lucide.createIcons();
    },

    confirmTaskDelivery(taskId) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        const confirmButton = document.getElementById('confirmDeliveryBtn');
        UI.buttonFeedback(confirmButton, 'success');
        const modal = document.getElementById('modalDeliveryConfirm');
        if (!task) return;

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const deliveryStamp = `${today}T12:00:00`;

        // `dateDelivered` is the canonical delivery date in the current
        // production/legacy Supabase schema. Set it on every delivery,
        // including a delivery after the task was reopened.
        task.dateDelivered = today;

        // Keep the modern timestamp when the installation supports it.
        if (DataService.taskSchemaCapabilities?.modern) {
            task.delivered_at = deliveryStamp;
        }

        if (!this.setTaskStatus(taskId, TASK_STATUS.DELIVERED)) return;
        this.recordLifecycleEvent(taskId, 'delivery', { delivered_at: deliveryStamp, persistedSeparately: Boolean(DataService.taskSchemaCapabilities?.modern) });
        this.queueLifecycleEvent(taskId, TASK_EVENT.DELIVERED, {
            delivered_at: DataService.taskSchemaCapabilities?.modern ? deliveryStamp : null,
            legacy_dateDelivered: DataService.taskSchemaCapabilities?.modern ? null : (task.dateDelivered || null)
        });
        this.selectedTaskId = String(taskId);
        this.markAsUnsaved();
        modal?.classList.remove('active');
        this.renderBoard();
        UI.showToast('Entrega registrada. Sincronizando…', 'success', 4500);
    },

    openReopenConfirmation(taskId, sourceButton = null) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        const modal = document.getElementById('modalReopenTask');
        if (!task || task.status !== TASK_STATUS.DELIVERED || !modal) return;

        const title = document.getElementById('reopenTaskTitle');
        const deadline = document.getElementById('reopenTaskDeadline');
        const assignee = document.getElementById('reopenTaskAssignee');
        if (title) title.textContent = normalizeText(task.name);
        if (deadline) deadline.textContent = getTaskDeadline(task) ? this.formatBusinessDate(getTaskDeadline(task)) : 'Sin fecha límite';
        if (assignee) assignee.textContent = normalizeAssignees(task.assignee).join(', ') || 'No asignado';

        modal.dataset.taskId = String(taskId);
        if (sourceButton instanceof HTMLElement && sourceButton.id) {
            modal.dataset.sourceButtonId = sourceButton.id;
        } else {
            delete modal.dataset.sourceButtonId;
        }
        modal.classList.add('active');
        lucide.createIcons();
    },

    confirmTaskReopen(taskId) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        UI.buttonFeedback(document.getElementById('confirmReopenBtn'), 'success');
        const modal = document.getElementById('modalReopenTask');
        if (!task || task.status !== TASK_STATUS.DELIVERED) return;

        const selected = document.querySelector('input[name=\"reopenTargetStatus\"]:checked');
        const targetStatus = selected?.value === TASK_STATUS.QUEUED
            ? TASK_STATUS.QUEUED
            : TASK_STATUS.IN_PROGRESS;
        const previousStatus = task.status;

        if (DataService.taskSchemaCapabilities?.modern) task.delivered_at = null;
        if (!this.setTaskStatus(taskId, targetStatus)) return;

        this.recordLifecycleEvent(taskId, 'restore', { from: previousStatus, to: targetStatus });
        this.queueLifecycleEvent(taskId, TASK_EVENT.RESTORED, {
            from: previousStatus,
            to: targetStatus,
            reason: 'devolución manual al flujo'
        });
        this.selectedTaskId = String(taskId);
        this.markAsUnsaved();
        modal?.classList.remove('active');
        this.renderBoard();

        const targetLabel = targetStatus === TASK_STATUS.QUEUED ? 'En cola' : 'En curso';
        UI.showToast(`Solicitud devuelta a gestión. Quedó ${targetLabel}. Conserva su historial.`, 'success', 7000);
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

        if (!this.setTaskStatus(taskId, TASK_STATUS.ADJUSTMENT)) return;
        this.recordLifecycleEvent(taskId, 'adjustment');
        this.queueLifecycleEvent(taskId, TASK_EVENT.ADJUSTMENT_REQUESTED, { reason: cleanReason });
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

        if (!this.setTaskStatus(taskId, TASK_STATUS.IN_PROGRESS)) return;
        this.queueLifecycleEvent(taskId, TASK_EVENT.ADJUSTMENT_STARTED);
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
            summaryAdjustment: active.filter(task => task.status === 'Ajuste solicitado').length,
            summaryOverdue: active.filter(task => { const deadline = getTaskDeadline(task); return deadline && deadline < todayStr; }).length,
            summaryStarred: active.filter(task => task.isStarred).length
        };

        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (!element) return;
            const previous = element.textContent;
            element.textContent = String(value);
            if (previous !== String(value)) {
                element.classList.remove('kpi-value-pulse');
                void element.offsetWidth;
                element.classList.add('kpi-value-pulse');
                window.setTimeout(() => element.classList.remove('kpi-value-pulse'), 460);
            }
        });

        const alertStates = [
            ['.summary-adjustment', values.summaryAdjustment > 0],
            ['.summary-overdue', values.summaryOverdue > 0],
            ['.summary-starred', values.summaryStarred > 0]
        ];
        alertStates.forEach(([selector, isActive]) => {
            const card = document.querySelector(selector);
            if (card) card.classList.toggle('has-attention', isActive);
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
                    this.animateHistoryNextRender = true;
                    this.renderHistory();
                }, 100);
            });
        }

        month?.addEventListener('change', () => {
            this.historyFilters.month = month.value;
            this.animateHistoryNextRender = true;
            this.renderHistory();
        });

        requester?.addEventListener('change', () => {
            this.historyFilters.requester = requester.value;
            this.animateHistoryNextRender = true;
            this.renderHistory();
        });

        assignee?.addEventListener('change', () => {
            this.historyFilters.assignee = assignee.value;
            this.animateHistoryNextRender = true;
            this.renderHistory();
        });

        status?.addEventListener('change', () => {
            this.historyFilters.status = status.value;
            this.animateHistoryNextRender = true;
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

        window.addEventListener('popstate', () => this.applyViewFromHash());
    },

    setupChangeHistoryView() {
        const search = document.getElementById('changeHistorySearch');
        const from = document.getElementById('changeHistoryFrom');
        const to = document.getElementById('changeHistoryTo');
        const user = document.getElementById('changeHistoryUser');
        const operation = document.getElementById('changeHistoryOperation');
        const clear = document.getElementById('clearChangeHistoryFilters');
        const loadMore = document.getElementById('changeHistoryLoadMore');

        search?.addEventListener('input', () => {
            this.changeHistoryFilters.search = normalizeText(search.value).toLowerCase();
            this.renderChangeHistory();
        });
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
        loadMore?.addEventListener('click', () => this.loadMoreChangeHistory());
    },

    async loadChangeHistory(reset = true) {
        if (this.changeHistoryLoading) return;
        this.changeHistoryLoading = true;
        try {
            if (reset) {
                this.changeHistory = await DataService.getChangeHistory(this.changeHistoryPageSize, 0);
            } else {
                const next = await DataService.getChangeHistory(this.changeHistoryPageSize, this.changeHistory.length);
                this.changeHistory = [...this.changeHistory, ...next];
                this.changeHistoryHasMore = next.length >= this.changeHistoryPageSize;
            }
            if (reset) this.changeHistoryHasMore = this.changeHistory.length >= this.changeHistoryPageSize;
            this.rebuildLifecycleRuntime();
            this.renderChangeHistory();
        } finally {
            this.changeHistoryLoading = false;
        }
    },

    async loadMoreChangeHistory() {
        if (!this.changeHistoryHasMore || this.changeHistoryLoading) return;
        const button = document.getElementById('changeHistoryLoadMore');
        if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
        await this.loadChangeHistory(false);
        if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
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
        const snapshot = entry.operation === 'DELETE' ? before : after;
        const historicalName = normalizeText(snapshot?.name || before?.name || after?.name || task?.name || `Solicitud #${entry.task_id}`);
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
        card.setAttribute('tabindex', '-1');

        const header = document.createElement('div');
        header.className = 'change-history-detail-header';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'change-history-detail-title-wrap';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', entry.operation === 'INSERT' ? 'plus-circle' : entry.operation === 'DELETE' ? 'trash-2' : 'history');
        const title = document.createElement('h2');
        title.id = 'changeHistoryDetailTitle';
        title.textContent = entry.operation === 'INSERT' ? 'Solicitud creada' : entry.operation === 'DELETE' ? 'Solicitud eliminada' : 'Detalle del cambio';
        titleWrap.append(icon, title);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-icon change-history-detail-close';
        close.setAttribute('aria-label', 'Cerrar detalle');
        close.title = 'Cerrar detalle';
        const closeIcon = document.createElement('i');
        closeIcon.setAttribute('data-lucide', 'x');
        close.appendChild(closeIcon);
        header.append(titleWrap, close);

        const taskName = document.createElement('div');
        taskName.className = 'change-history-detail-task';
        taskName.textContent = historicalName;

        const meta = document.createElement('div');
        meta.className = 'change-history-detail-meta';
        const operationText = entry.operation === 'INSERT' ? 'Creación' : entry.operation === 'DELETE' ? 'Eliminación' : 'Modificación';
        const changedUser = (this.usersList || []).find(u => String(u.id) === String(entry.changed_by));
        const userName = normalizeText(changedUser?.name || changedUser?.username || 'Usuario');
        meta.textContent = `${operationText} · ${this.formatChangeHistoryDate(entry.created_at)} · ${userName}`;

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
            message.textContent = 'Se eliminó esta solicitud. Los datos mostrados corresponden a su última versión registrada.';
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
            restore.append(restoreIcon, document.createTextNode(' Restaurar estado anterior'));
            restore.title = 'Restaurar los datos que existían antes de este cambio';
            restore.addEventListener('click', async () => {
                const confirmed = confirm(`¿Restaurar el estado anterior al cambio del ${this.formatChangeHistoryDate(entry.created_at)}? El estado actual quedará registrado como un nuevo cambio.`);
                if (!confirmed) return;
                restore.disabled = true;
                try {
                    const result = await DataService.restoreTaskVersion(entry.task_id, before, task.version);
                    if (!result?.cloudSaved) {
                        restore.disabled = false;
                        if (result?.error?.code === 'DH_CONFLICT') {
                            UI.showToast('La tarea cambió en otra sesión. Recarga el historial antes de volver a restaurar.', 'warning', 9000);
                        } else {
                            UI.showToast('No se pudo restaurar el estado anterior.', 'error');
                        }
                        return;
                    }
                    closeViewer();
                    await this.loadData();
                    await this.loadChangeHistory(true);
                    UI.showToast('Estado anterior restaurado correctamente.', 'success');
                } catch (error) {
                    console.error('Error al restaurar versión:', error);
                    restore.disabled = false;
                    UI.showToast('No se pudo restaurar el estado anterior.', 'error');
                }
            });
            footer.appendChild(restore);
        }

        card.append(header, taskName, meta, body, footer);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        lucide.createIcons();

        this.changeHistoryLastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const closeViewer = () => {
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown);
            if (this.changeHistoryLastFocusedElement?.isConnected) this.changeHistoryLastFocusedElement.focus();
            this.changeHistoryLastFocusedElement = null;
        };
        const onKeyDown = event => {
            if (event.key === 'Escape') { closeViewer(); return; }
            if (event.key !== 'Tab') return;
            const focusable = [...card.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
            if (!focusable.length) { event.preventDefault(); card.focus(); return; }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        close.addEventListener('click', closeViewer);
        closeFooter.addEventListener('click', closeViewer);
        overlay.addEventListener('click', event => { if (event.target === overlay) closeViewer(); });
        document.addEventListener('keydown', onKeyDown);
        window.requestAnimationFrame(() => close.focus());
    },

    renderChangeHistory() {
        const body = document.getElementById('changeHistoryTableBody');
        const empty = document.getElementById('changeHistoryEmpty');
        if (!body || !empty) return;

        const filters = this.changeHistoryFilters || { search:'', from:'', to:'', user:'Todos', operation:'Todos' };
        const tasks = Array.isArray(this.tasks) ? this.tasks : [];
        const users = Array.isArray(this.usersList) ? this.usersList : [];
        const taskMap = new Map(tasks.map(task => [String(task.id), task]));
        const userMap = new Map(users.map(user => [String(user.id), normalizeText(user.name || user.username || 'Usuario')]));
        const labels = { name:'Solicitud', requester:'Solicitante', assignee:'Responsable', status:'Estado', dateReceived:'Recepción', dateDelivered:'Entrega', isStarred:'Prioridad', notes:'Notas' };
        const display = (field, value) => {
            if (field === 'isStarred') return value ? 'Prioritaria' : 'Normal';
            if (field === 'dateReceived' || field === 'dateDelivered') {
                const text = normalizeText(value);
                if (!text) return 'Vacío';
                const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
            }
            if (value === null || value === undefined || value === '') return 'Vacío';
            return String(value);
        };
        const localDateKey = value => {
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return '';
            const y = parsed.getFullYear(); const m = String(parsed.getMonth()+1).padStart(2,'0'); const d = String(parsed.getDate()).padStart(2,'0');
            return `${y}-${m}-${d}`;
        };
        const changedFields = entry => {
            const before = this.parseChangeHistoryData(entry.before_data);
            const after = this.parseChangeHistoryData(entry.after_data);
            return Object.keys(labels).filter(field => String(before[field] ?? '') !== String(after[field] ?? ''));
        };
        const category = (entry, fields) => {
            if (entry.operation === 'INSERT') return { label:'Creación', key:'insert' };
            if (entry.operation === 'DELETE') return { label:'Eliminación', key:'delete' };
            if (fields.includes('status')) {
                const before = this.parseChangeHistoryData(entry.before_data);
                const after = this.parseChangeHistoryData(entry.after_data);
                if (after.status === 'Ajuste solicitado') return { label:'Ajuste solicitado', key:'adjustment' };
                return { label:'Cambio de estado', key:'status' };
            }
            if (fields.includes('assignee')) return { label:'Asignación', key:'assignment' };
            if (fields.some(field => field === 'dateReceived' || field === 'dateDelivered')) return { label:'Cambio de fecha', key:'date' };
            return { label:'Modificación', key:'update' };
        };

        const rows = (this.changeHistory || []).filter(entry => {
            const task = taskMap.get(String(entry.task_id));
            const username = userMap.get(String(entry.changed_by)) || 'Usuario';
            const before = this.parseChangeHistoryData(entry.before_data);
            const after = this.parseChangeHistoryData(entry.after_data);
            const fields = changedFields(entry);
            const historicalSnapshot = entry.operation === 'DELETE' ? before : after;
            const historicalName = historicalSnapshot.name || before.name || after.name || task?.name || `Solicitud #${entry.task_id}`;
            const summary = fields.map(field => `${labels[field]} ${display(field,before[field])} ${display(field,after[field])}`).join(' ');
            const haystack = [historicalName, before.requester, after.requester, before.assignee, after.assignee, username, entry.operation, category(entry, fields).label, summary].map(normalizeText).join(' ').toLowerCase();
            const date = localDateKey(entry.created_at);
            if (filters.search && !haystack.includes(filters.search)) return false;
            if (filters.user !== 'Todos' && String(entry.changed_by) !== String(filters.user)) return false;
            if (filters.operation !== 'Todos' && entry.operation !== filters.operation) return false;
            if (filters.from && (!date || date < filters.from)) return false;
            if (filters.to && (!date || date > filters.to)) return false;
            return true;
        });

        const userSelect = document.getElementById('changeHistoryUser');
        if (userSelect && userSelect.options.length <= 1) {
            const ids = [...new Set((this.changeHistory || []).map(entry => String(entry.changed_by)).filter(Boolean))];
            ids.sort((a,b) => (userMap.get(a)||'Usuario').localeCompare(userMap.get(b)||'Usuario','es'));
            ids.forEach(id => {
                const option = document.createElement('option');
                option.value = id; option.textContent = userMap.get(id) || 'Usuario';
                userSelect.appendChild(option);
            });
        }

        body.replaceChildren();
        const count = document.getElementById('changeHistoryCount');
        const result = document.getElementById('changeHistoryResult');
        if (count) count.textContent = String(rows.length);
        if (result) result.textContent = `${rows.length} cambio${rows.length === 1 ? '' : 's'} · ${(new Set(rows.map(entry => String(entry.task_id)))).size} solicitud${(new Set(rows.map(entry => String(entry.task_id)))).size === 1 ? '' : 'es'}`;
        empty.hidden = rows.length !== 0;
        const loadWrap = document.getElementById('changeHistoryLoadMoreWrap');
        const loadButton = document.getElementById('changeHistoryLoadMore');
        if (loadWrap) loadWrap.hidden = !this.changeHistoryHasMore;
        if (loadButton) loadButton.disabled = this.changeHistoryLoading;
        if (!rows.length) return;

        const fragment = document.createDocumentFragment();
        rows.forEach((entry,index) => {
            const task = taskMap.get(String(entry.task_id));
            const before = this.parseChangeHistoryData(entry.before_data);
            const after = this.parseChangeHistoryData(entry.after_data);
            const fields = changedFields(entry);
            const snapshot = entry.operation === 'DELETE' ? before : after;
            const historicalName = normalizeText(snapshot.name || before.name || after.name || task?.name || `Solicitud #${entry.task_id}`);
            const username = userMap.get(String(entry.changed_by)) || 'Usuario';
            const kind = category(entry, fields);
            const item = document.createElement('article');
            item.className = `change-history-item category-${kind.key}`;
            item.setAttribute('role','listitem');
            item.dataset.historyId = String(entry.id);
            item.style.animationDelay = `${Math.min(index,8)*18}ms`;

            const main = document.createElement('div'); main.className='change-history-main';
            const date = document.createElement('time'); date.className='change-history-date'; date.dateTime=entry.created_at||''; date.textContent=this.formatChangeHistoryDate(entry.created_at);
            const title = document.createElement('div'); title.className='change-history-title'; title.textContent=historicalName;
            const meta = document.createElement('div'); meta.className='change-history-meta';
            const operation = document.createElement('span'); operation.className=`change-history-operation ${kind.key}`; operation.textContent=kind.label;
            const user = document.createElement('span'); user.className='change-history-user'; user.textContent=username;
            meta.append(operation,user);
            const detail = document.createElement('div'); detail.className='change-history-detail';
            if (entry.operation === 'INSERT') detail.textContent='Se creó la solicitud.';
            else if (entry.operation === 'DELETE') detail.textContent='Se eliminó la solicitud.';
            else if (!fields.length) detail.textContent='Cambio registrado.';
            else {
                detail.textContent=fields.slice(0,2).map(field=>`${labels[field]}: ${display(field,before[field])} → ${display(field,after[field])}`).join(' · ');
                if(fields.length>2) detail.textContent += ` · +${fields.length-2} cambio${fields.length-2===1?'':'s'}`;
            }
            main.append(date,title,meta,detail);

            const actions=document.createElement('div'); actions.className='change-history-action';
            const viewButton=document.createElement('button'); viewButton.type='button'; viewButton.className='btn-text change-history-view-detail'; viewButton.innerHTML='<i data-lucide="eye" aria-hidden="true"></i> Ver cambios'; viewButton.setAttribute('aria-label',`Ver cambios de ${historicalName}`);
            viewButton.addEventListener('click',()=>this.openChangeHistoryDetail(entry,task,labels,display)); actions.appendChild(viewButton);
            item.append(main,actions); fragment.appendChild(item);
        });
        body.appendChild(fragment);
        lucide.createIcons();
    },

    openDeleteConfirmation(taskId, sourceButton = null) {
        document.getElementById('deleteTaskConfirmDialog')?.remove();
        const task = (this.tasks || []).find(item => String(item.id) === String(taskId));
        if (!task) return;

        const overlay = document.createElement('div');
        overlay.id = 'deleteTaskConfirmDialog';
        overlay.className = 'delete-confirm-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'deleteTaskConfirmTitle');
        overlay.setAttribute('aria-describedby', 'deleteTaskConfirmDescription');

        const card = document.createElement('div');
        card.className = 'delete-confirm-card';
        card.setAttribute('tabindex', '-1');

        const iconWrap = document.createElement('div');
        iconWrap.className = 'delete-confirm-icon';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'trash-2');
        icon.setAttribute('aria-hidden', 'true');
        iconWrap.appendChild(icon);

        const title = document.createElement('h2');
        title.id = 'deleteTaskConfirmTitle';
        title.textContent = 'Eliminar solicitud';

        const description = document.createElement('p');
        description.id = 'deleteTaskConfirmDescription';
        description.textContent = 'La solicitud se quitará de la gestión. El cambio quedará pendiente de guardar en la nube.';

        const taskName = document.createElement('strong');
        taskName.className = 'delete-confirm-task';
        taskName.textContent = normalizeText(task.name);

        const footer = document.createElement('div');
        footer.className = 'delete-confirm-footer';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-secondary';
        cancel.textContent = 'Cancelar';
        const confirmDelete = document.createElement('button');
        confirmDelete.type = 'button';
        confirmDelete.className = 'btn btn-danger delete-confirm-action';
        const deleteIcon = document.createElement('i');
        deleteIcon.setAttribute('data-lucide', 'trash-2');
        deleteIcon.setAttribute('aria-hidden', 'true');
        confirmDelete.append(deleteIcon, document.createTextNode(' Eliminar solicitud'));
        footer.append(cancel, confirmDelete);

        card.append(iconWrap, title, description, taskName, footer);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        lucide.createIcons();

        const previousFocus = sourceButton instanceof HTMLElement ? sourceButton : document.activeElement;
        const close = () => {
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown);
            if (previousFocus?.isConnected) previousFocus.focus();
        };
        const onKeyDown = event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); return; }
            if (event.key !== 'Tab') return;
            const focusable = [...card.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
            if (!focusable.length) { event.preventDefault(); card.focus(); return; }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };

        cancel.addEventListener('click', close);
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        confirmDelete.addEventListener('click', () => {
            this.tasks = this.tasks.filter(item => String(item.id) !== String(taskId));
            this.markAsUnsaved();
            close();
            this.renderBoard();
            UI.showToast('Solicitud eliminada. Se guardará automáticamente.', 'success');
        });
        document.addEventListener('keydown', onKeyDown);
        window.requestAnimationFrame(() => cancel.focus());
    },

    showView(view) {
        const isRequestHistory = view === 'history';
        const isChangeHistory = view === 'change-history';
        const isBoard = !isRequestHistory && !isChangeHistory;
        const secondary = !isBoard;
        const layoutGrid = document.querySelector('.layout-grid');
        const dashboardSummary = document.querySelector('.dashboard-summary');
        const requestHistory = document.getElementById('historyView');
        const changeHistory = document.getElementById('changeHistoryView');

        // Las tres pantallas son vistas excluyentes. Usamos hidden + display inline
        // para que ningún override CSS pueda dejar el historial visible debajo de Gestión.
        if (layoutGrid) {
            layoutGrid.hidden = secondary;
            layoutGrid.style.display = secondary ? 'none' : '';
        }
        if (dashboardSummary) {
            dashboardSummary.hidden = secondary;
            dashboardSummary.style.display = secondary ? 'none' : '';
        }
        if (requestHistory) {
            requestHistory.hidden = !isRequestHistory;
            requestHistory.style.display = isRequestHistory ? 'block' : 'none';
        }
        if (changeHistory) {
            changeHistory.hidden = !isChangeHistory;
            changeHistory.style.display = isChangeHistory ? 'block' : 'none';
        }

        this.currentView = isRequestHistory ? 'history' : isChangeHistory ? 'change-history' : 'board';
        document.getElementById('appContainer')?.setAttribute('data-view', this.currentView);

        document.querySelectorAll('.history-view-tab, .workspace-tab').forEach(tab => {
            const active = (isBoard && (tab.classList.contains('history-tab-board') || tab.id === 'boardWorkspaceTab'))
                || (isRequestHistory && (tab.id === 'historyTabRequests' || tab.id === 'changeHistoryTabRequests' || tab.id === 'boardWorkspaceRequests'))
                || (isChangeHistory && (tab.id === 'historyTabChanges' || tab.id === 'changeHistoryTabChanges' || tab.id === 'boardWorkspaceChanges'));
            tab.classList.toggle('is-active', active);
            if (active) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });

        const targetHash = isRequestHistory ? '#solicitudes-realizadas' : isChangeHistory ? '#historial-cambios' : '';
        if (targetHash) window.history.pushState(null, '', targetHash);
        else if (window.location.hash) window.history.pushState(null, '', window.location.pathname + window.location.search);

        if (isRequestHistory) {
            this.animateHistoryNextRender = true;
            this.renderHistory();
        }
        if (isChangeHistory) this.renderChangeHistory();
        if (isBoard) this.renderBoard();

        const viewToAnimate = isRequestHistory ? requestHistory : isChangeHistory ? changeHistory : document.getElementById('mainContent');
        UI.animateView(viewToAnimate);

        requestAnimationFrame(() => {
            if (window.lucide) lucide.createIcons({attrs:{'aria-hidden':'true'}});
            const activeView = isRequestHistory ? requestHistory : isChangeHistory ? changeHistory : document.getElementById('mainContent');
            activeView?.removeAttribute('inert');
        });
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
        const formatTaskDate = (value) => {
            const text = normalizeText(value);
            if (!text) return '—';
            const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
            if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
            const parsed = new Date(text);
            if (!Number.isNaN(parsed.getTime())) {
                const y = parsed.getFullYear();
                const m = String(parsed.getMonth() + 1).padStart(2, '0');
                const d = String(parsed.getDate()).padStart(2, '0');
                return `${d}/${m}/${y}`;
            }
            return text;
        };

        const allTasks = (Array.isArray(this.tasks) ? this.tasks : [])
            .filter(task => normalizeText(task.status) === 'Entregado');

        const filtered = allTasks
            .filter(task => {
                if (filters.month && monthOf(task.dateReceived) !== filters.month) return false;
                if (filters.requester !== 'Todos' && normalizeText(task.requester) !== filters.requester) return false;
                if (filters.assignee !== 'Todos' && !taskHasAssignee(task, filters.assignee)) return false;
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

        const animateHistoryRows = Boolean(this.animateHistoryNextRender);
        this.animateHistoryNextRender = false;

        filtered.forEach((task, index) => {
            const row = document.createElement('tr');
            if (animateHistoryRows) {
                row.classList.add('history-row-enter');
                row.style.setProperty('--dh-row-delay', `${Math.min(index, 7) * 28}ms`);
            }

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
            receivedCell.textContent = formatTaskDate(task.dateReceived);

            const deliveryCell = document.createElement('td');
            const actualDeliveryDate = getTaskDeliveredDate(task);
            deliveryCell.textContent = actualDeliveryDate
                ? `${formatTaskDate(actualDeliveryDate)} · Entrega ${Math.max(1, lifecycle.deliveries)}`
                : '—';

            const statusCell = document.createElement('td');
            const status = normalizeText(task.status) || 'Sin estado';
            statusCell.innerHTML = `<span class="history-status ${status === 'En curso' ? 'course' : status === 'Entregado' ? 'done' : status === 'Ajuste solicitado' ? 'adjustment' : 'queue'}">${escapeHTML(status)}</span>`;

            const actionCell = document.createElement('td');
            actionCell.className = 'history-actions-cell';
            if (status === 'Entregado') {
                const actionsWrap = document.createElement('div');
                actionsWrap.className = 'history-delivery-actions';

                const returnButton = document.createElement('button');
                returnButton.type = 'button';
                returnButton.className = 'btn-text history-return-button';
                returnButton.textContent = 'Solicitar ajuste';
                returnButton.title = 'Registrar el motivo y devolver la solicitud a gestión';
                returnButton.setAttribute('aria-label', `Solicitar ajuste para ${normalizeText(task.name)}`);
                returnButton.addEventListener('click', () => this.requestTaskAdjustment(task.id));

                const flowButton = document.createElement('button');
                flowButton.type = 'button';
                flowButton.className = 'btn-text history-flow-return-button';
                flowButton.innerHTML = '<i data-lucide=\"undo-2\" aria-hidden=\"true\"></i><span>Devolver al flujo</span>';
                flowButton.title = 'Devolver la solicitud a Gestión';
                flowButton.setAttribute('aria-label', `Devolver al flujo ${normalizeText(task.name)}`);
                flowButton.addEventListener('click', () => this.openReopenConfirmation(task.id, flowButton));

                actionsWrap.append(returnButton, flowButton);
                actionCell.appendChild(actionsWrap);
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
        lucide.createIcons();
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
            const currentValue = select.value;
            const currentValues = select.multiple
                ? Array.from(select.selectedOptions).map(option => option.value)
                : [currentValue];
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
            if (select.multiple) {
                Array.from(select.options).forEach(option => {
                    option.selected = currentValues.includes(option.value);
                });
            } else if ([...select.options].some(option => option.value === currentValue)) {
                select.value = currentValue;
            }
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

        this.updateAdvancedFiltersSummary();
        // Un solo ciclo reconstruye filtros, Nueva solicitud, edición y tabla.
        // Evita wrappers anidados y menús duplicados.
        buildCustomSelects(document);
    },

    resetBoardFilters({ keepSort = true } = {}) {
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            updateCustomSelectUI(el, value);
        };

        setValue('filterAssignee', 'Todos');
        setValue('filterRequester', 'Todos');
        setValue('filterStatus', 'Todos');
        setValue('filterCompletion', 'Pendientes');
        if (!keepSort) setValue('filterSort', 'received_asc');

        const search = document.getElementById('taskSearch');
        if (search) search.value = '';

        this.filterDates = [];
        const dateInput = document.getElementById('filterDate');
        if (dateInput?._flatpickr) dateInput._flatpickr.clear();

        this.updateAdvancedFiltersSummary();
    },

    activateQuickFilter(filter) {
        this.resetBoardFilters();
        this.quickFilter = filter || 'all';
        document.querySelectorAll('.quick-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.quickFilter === this.quickFilter);
        });
        this.renderBoard();
    },

    updateAdvancedFiltersSummary() {
        const summary = document.getElementById('advancedFiltersSummary');
        if (!summary) return;

        const labels = [];
        const dateInput = document.getElementById('filterDate');
        const assignee = document.getElementById('filterAssignee')?.value || 'Todos';
        const requester = document.getElementById('filterRequester')?.value || 'Todos';
        const status = document.getElementById('filterStatus')?.value || 'Todos';
        const completion = document.getElementById('filterCompletion')?.value || 'Pendientes';
        const sort = document.getElementById('filterSort')?.value || 'received_asc';

        if (dateInput?.value?.trim()) labels.push('fecha');
        if (requester !== 'Todos') labels.push('solicitante');
        if (assignee !== 'Todos') labels.push('asignación');
        if (status !== 'Todos') labels.push('estado');
        if (completion !== 'Pendientes') labels.push(completion === 'Realizadas' ? 'realizadas' : 'todas');
        if (sort !== 'received_asc') labels.push('orden');

        if (!labels.length) {
            summary.textContent = 'Sin filtros adicionales';
            summary.removeAttribute('data-active');
            return;
        }

        summary.textContent = `${labels.length} filtro${labels.length === 1 ? '' : 's'} aplicado${labels.length === 1 ? '' : 's'}`;
        summary.setAttribute('data-active', 'true');
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
            if (field === 'dateDelivered' && t.status !== 'Entregado' && DataService.taskSchemaCapabilities?.modern) {
                t.due_at = value ? `${normalizeText(value)}T12:00:00` : null;
            }
            this.selectedTaskId = String(id);
            this.markAsUnsaved();
            this.renderWorkloadChart(this.tasks.filter(x => x.status !== 'Entregado'));
            if (shouldRender) this.renderBoard();
        }
    },

    async openTaskTimeline(taskId, sourceButton = null) {
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task) return;

        const entries = await DataService.getTaskChangeHistory(taskId);
        const existing = document.getElementById('taskTimelineDialog');
        existing?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'taskTimelineDialog';
        overlay.className = 'modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'taskTimelineTitle');

        const card = document.createElement('div');
        card.className = 'task-timeline-card';

        const header = document.createElement('div');
        header.className = 'task-timeline-header';
        const titleWrap = document.createElement('div');
        const title = document.createElement('h2');
        title.id = 'taskTimelineTitle';
        title.textContent = 'Historial de la solicitud';
        const subtitle = document.createElement('p');
        subtitle.className = 'task-timeline-subtitle';
        subtitle.textContent = normalizeText(task.name);
        titleWrap.append(title, subtitle);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-icon';
        close.setAttribute('aria-label', 'Cerrar historial de la solicitud');
        close.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
        header.append(titleWrap, close);

        const body = document.createElement('div');
        body.className = 'task-timeline-body';
        const events = [];
        let deliveryNumber = 0;
        let adjustmentNumber = 0;

        const parse = value => this.parseChangeHistoryData(value);
        const actorName = entry => {
            const user = (this.usersList || []).find(u => String(u.id) === String(entry.changed_by));
            return normalizeText(user?.name || user?.username || 'Usuario');
        };
        const addEvent = (entry, kind, label, detail = '') => events.push({ entry, kind, label, detail, actor: actorName(entry) });

        entries.forEach(entry => {
            const before = parse(entry.before_data);
            const after = parse(entry.after_data);
            const beforeStatus = normalizeText(before.status);
            const afterStatus = normalizeText(after.status);
            if (entry.operation === 'INSERT') {
                addEvent(entry, 'created', 'Solicitud creada');
                return;
            }
            if (entry.operation === 'DELETE') {
                addEvent(entry, 'deleted', 'Solicitud eliminada');
                return;
            }
            if (afterStatus === 'Entregado' && beforeStatus !== 'Entregado') {
                deliveryNumber += 1;
                addEvent(entry, 'delivery', `Entrega #${deliveryNumber}`);
            } else if (afterStatus === 'Ajuste solicitado' && beforeStatus !== 'Ajuste solicitado') {
                adjustmentNumber += 1;
                const reason = this.getLatestAdjustmentReason({ notes: after.notes });
                addEvent(entry, 'adjustment', `Ajuste #${adjustmentNumber}`, reason);
            } else if (afterStatus === 'En curso' && beforeStatus !== 'En curso') {
                addEvent(entry, 'started', 'Trabajo iniciado');
            } else if (String(before.assignee ?? '') !== String(after.assignee ?? '')) {
                const assignee = normalizeText(after.assignee) || 'No asignado';
                addEvent(entry, 'assignment', 'Asignación actualizada', `Responsable: ${assignee}`);
            } else {
                addEvent(entry, 'update', 'Solicitud actualizada');
            }
        });

        if (!events.length) {
            const empty = document.createElement('p');
            empty.className = 'task-timeline-empty';
            empty.textContent = 'Todavía no hay eventos históricos disponibles para esta solicitud.';
            body.appendChild(empty);
        } else {
            const list = document.createElement('ol');
            list.className = 'task-timeline-list';
            events.forEach(event => {
                const item = document.createElement('li');
                item.className = `task-timeline-event event-${event.kind}`;
                const marker = document.createElement('span');
                marker.className = 'task-timeline-marker';
                marker.setAttribute('aria-hidden', 'true');
                const content = document.createElement('div');
                content.className = 'task-timeline-content';
                const eventHeader = document.createElement('div');
                eventHeader.className = 'task-timeline-event-header';
                const label = document.createElement('strong');
                label.textContent = event.label;
                const date = document.createElement('time');
                date.dateTime = event.entry.created_at || '';
                date.textContent = this.formatChangeHistoryDate(event.entry.created_at);
                eventHeader.append(label, date);
                const meta = document.createElement('span');
                meta.className = 'task-timeline-actor';
                meta.textContent = event.actor;
                content.append(eventHeader, meta);
                if (event.detail) {
                    const detail = document.createElement('p');
                    detail.className = 'task-timeline-detail';
                    detail.textContent = event.detail;
                    content.appendChild(detail);
                }
                item.append(marker, content);
                list.appendChild(item);
            });
            body.appendChild(list);
        }

        card.append(header, body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        lucide.createIcons();

        close.addEventListener('click', () => overlay.classList.remove('active'));
        overlay.addEventListener('click', event => { if (event.target === overlay) overlay.classList.remove('active'); });
        overlay.dataset.sourceButtonId = sourceButton?.id || '';
        overlay.classList.add('active');
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

    focusTaskInBoard(taskId) {
        const id = String(taskId);
        this.selectTask(id);
        const row = document.querySelector(`.task-table tr[data-task-row="${CSS.escape(id)}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        row.classList.add('task-jump-highlight');
        window.setTimeout(() => row.classList.remove('task-jump-highlight'), 1400);
        window.setTimeout(() => {
            const target = row.querySelector('.req-title-text') || row.querySelector('button, input, select');
            target?.focus({ preventScroll: true });
        }, 80);
    },

    formatBusinessDate(value) {
        const normalized = normalizeText(value);
        if (!normalized) return 'Sin fecha';
        const date = parseLocalDate(normalized);
        if (!date) return normalized;
        const formatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
        const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
        if (diff === 0) return `${formatted} · HOY`;
        if (diff === 1) return `${formatted} · MAÑANA`;
        if (diff < 0) return `${formatted} · VENCIDA ${Math.abs(diff)} día${Math.abs(diff) === 1 ? '' : 's'}`;
        return formatted;
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
            const mAsig = fAssignee === 'Todos' || taskHasAssignee(t, fAssignee);
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
                mQuick = !!this.user && taskHasAssignee(t, this.user.name);
            } else if (this.quickFilter === 'unassigned') {
                mQuick = normalizeAssignees(t.assignee).length === 0;
            } else if (this.quickFilter === 'overdue') {
                mQuick = t.status !== 'Entregado' && !!getTaskDeadline(t) && dateValue(getTaskDeadline(t)) < Date.now();
            } else if (this.quickFilter === 'today') {
                mQuick = t.status !== 'Entregado' && getTaskDeadline(t) === todayStr;
            } else if (this.quickFilter === 'course') {
                mQuick = t.status === 'En curso';
            } else if (this.quickFilter === 'adjustment') {
                mQuick = t.status === 'Ajuste solicitado';
            } else if (this.quickFilter === 'queue') {
                mQuick = t.status === 'En cola';
            }

            let mDate = true;
            if (this.filterDates.length > 0) {
                const boardDate = getTaskBoardDate(t);
                if (!boardDate) {
                    mDate = false;
                } else {
                    const start = new Date(this.filterDates[0]);
                    start.setHours(0, 0, 0, 0);
                    const end = this.filterDates.length > 1
                        ? new Date(this.filterDates[1])
                        : new Date(this.filterDates[0]);
                    end.setHours(23, 59, 59, 999);
                    const taskDate = new Date(boardDate + 'T12:00:00');
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
            // Orden de trabajo: las solicitudes que están En curso aparecen
            // siempre primero para que el equipo tenga a mano lo que está trabajando.
            // Dentro de cada grupo se conserva el criterio de orden elegido por el usuario.
            const aInProgress = normalizeText(a.status) === TASK_STATUS.IN_PROGRESS || normalizeText(a.status) === 'En curso';
            const bInProgress = normalizeText(b.status) === TASK_STATUS.IN_PROGRESS || normalizeText(b.status) === 'En curso';
            if (aInProgress && !bInProgress) return -1;
            if (!aInProgress && bInProgress) return 1;

            // Después de En curso, las prioridades conservan su precedencia.
            if (a.isStarred && !b.isStarred) return -1;
            if (!a.isStarred && b.isStarred) return 1;

            const receivedA = dateValue(a.dateReceived);
            const receivedB = dateValue(b.dateReceived);
            const deliveryA = dateValue(getTaskBoardDate(a));
            const deliveryB = dateValue(getTaskBoardDate(b));

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

        const myTasks = this.tasks.filter(t => t.status !== TASK_STATUS.DELIVERED && (
                (t.assignee_id && this.user?.id && String(t.assignee_id) === String(this.user.id)) ||
                (!t.assignee_id && taskHasAssignee(t, this.user.name))
            )).sort(sortTasks);
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

            const openMyTask = (event) => {
                if (event.target.closest('input, button')) return;
                this.activateQuickFilter('mine');
                window.setTimeout(() => this.focusTaskInBoard(t.id), 0);
                handleExpand(event);
            };

            li.addEventListener('click', openMyTask);

            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openMyTask(e);
                }
            });
            
            const colorHex = this.getColor(t.assignee);
            
            let dateClass = '';
            let dateAlertIcon = '';
            let overDueBadge = '';

            if (getTaskDeadline(t)) {
                if (getTaskDeadline(t) < todayStr) {
                    dateClass = 'text-danger';
                    dateAlertIcon = '<i data-lucide="alert-triangle" class="text-danger" style="width:14px;height:14px;margin-right:2px;"></i>';
                    overDueBadge = '<span class="time-alert-badge danger">¡Vencida!</span>';
                } else if (getTaskDeadline(t) === todayStr) {
                    dateClass = 'text-warning';
                    dateAlertIcon = '<i data-lucide="clock" class="text-warning" style="width:14px;height:14px;margin-right:2px;"></i>';
                    overDueBadge = '<span class="time-alert-badge warning">Para Hoy</span>';
                }
            }
            
            li.innerHTML = `
                <div class="req-header">
                    <span class="req-name">
                        ${t.isStarred && isTaskActive(t) ? `<button type="button" class="btn-star active" style="color:${escapeHTML(getPriorityColor(t))};" data-action="toggle-star" data-task-id="${escapeHTML(t.id)}" aria-label="Quitar prioridad" title="Prioridad marcada por ${escapeHTML(getPriorityActor(t) || 'usuario')}">
                            <i data-lucide="star" style="width: 14px; height: 14px;"></i>
                        </button>` : ''}
                        <span class="req-name-text" title="${escapeHTML(t.name)}">${escapeHTML(t.name)}</span>
                    </span>
                    <div class="req-dates">
                        <span class="req-date-line" style="white-space: nowrap;">Rec.: ${t.dateReceived ? t.dateReceived.split('-').reverse().join('/') : 'N/A'}</span>
                        <div class="req-date-line req-date-deadline" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                            <span class="${dateClass}" style="display:flex; align-items:center; white-space:nowrap;">Límite: <strong style="display:inline-flex; align-items:center; margin-left:4px;">${dateAlertIcon}${getTaskDeadline(t) ? getTaskDeadline(t).split('-').reverse().join('/') : 'Seleccionar'}</strong></span>
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

        let assigneeOpts = this.members.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');
        
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
            
            const boardDate = getTaskBoardDate(t);
            const deadlineDate = getTaskDeadline(t);
            const deliveredDate = getTaskDeliveredDate(t);
            let dateDeliveredVal = t.status === 'Entregado' ? (deliveredDate || '') : (deadlineDate || '');
            let dateClass = '';
            if (boardDate && t.status !== 'Entregado') {
                if (boardDate < todayStr) dateClass = 'text-danger';
                else if (boardDate === todayStr) dateClass = 'text-warning';
            }
            
            const taskId = escapeHTML(t.id);
            const taskNameEscaped = escapeHTML(t.name);
            const statusClass = {
                'En cola': 'status-select-queue',
                'En curso': 'status-select-progress',
                'Ajuste solicitado': 'status-select-adjustment',
                'Entregado': 'status-select-completed'
            }[t.status] || 'status-select-queue';
            const statusActions = {
                'En cola': [
                    ['En cola', 'En cola', 'pause-circle'],
                    ['En curso', 'En curso', 'play-circle']
                ],
                'En curso': [
                    ['En cola', 'En cola', 'pause-circle'],
                    ['En curso', 'En curso', 'play-circle'],
                    ['Entregado', 'Entregar', 'check-circle-2']
                ],
                'Ajuste solicitado': [
                    ['Ajuste solicitado', 'Ajuste solicitado', 'message-square-warning'],
                    ['En curso', 'Iniciar ajuste', 'play']
                ],
                'Entregado': [
                    ['Entregado', 'Entregada', 'check-circle-2'],
                    ['__REOPEN__', 'Reabrir', 'undo-2']
                ]
            };
            const actionsForStatus = statusActions[t.status] || statusActions['En cola'];
            const statusButtons = `<div class="status-switch status-switch-${statusClass.replace('status-select-', '')}" role="group" aria-label="Acciones de estado para ${taskNameEscaped}">
                ${actionsForStatus.map(([value, label, icon], index) => {
                    const isCurrent = value === t.status;
                    const isReopen = value === '__REOPEN__';
                    const actionLabel = isReopen ? 'Reabrir solicitud y devolver a gestión' : label;
                    return `<button type="button" class="status-switch-btn ${isCurrent ? 'is-current' : ''} ${isReopen ? 'is-reopen' : ''}" data-action="${isReopen ? 'reopen-task' : 'set-status'}" data-task-id="${taskId}" data-status="${isReopen ? '' : escapeHTML(value)}" aria-label="${escapeHTML(actionLabel)}" title="${escapeHTML(actionLabel)}" ${isCurrent ? 'aria-current="true"' : ''}><i data-lucide="${icon}" aria-hidden="true"></i><span>${escapeHTML(label)}</span></button>`;
                }).join('')}
            </div>`;

            tr.innerHTML = `
                <td data-label="Solicitud">
                    <div class="req-title-cell">
                        <strong>
                            ${isTaskActive(t) ? `<button type="button" class="btn-star ${t.isStarred ? 'active' : ''}" style="${t.isStarred ? `color:${escapeHTML(getPriorityColor(t))};` : ''}" data-action="toggle-star" data-task-id="${escapeHTML(t.id)}" aria-label="${t.isStarred ? 'Quitar prioridad' : 'Marcar como prioridad'}" title="${t.isStarred ? `Prioridad marcada por ${escapeHTML(getPriorityActor(t) || 'usuario')}` : 'Marcar como prioridad'}">
                                <i data-lucide="star" aria-hidden="true"></i>
                            </button>` : ''}
                            <span class="req-title-text" title="${escapeHTML(t.name)}">${escapeHTML(t.name)}</span>
                        </strong>
                        <span>${escapeHTML(t.requester)}</span>
                        ${(() => { const lc = this.getTaskLifecycle(t); return lc.deliveries || lc.adjustments ? `<span class="task-lifecycle-meta">${lc.deliveries} entrega${lc.deliveries === 1 ? '' : 's'} · ${lc.adjustments} ajuste${lc.adjustments === 1 ? '' : 's'}</span>` : ''; })()}
                    </div>
                </td>
                <td data-label="Asignación">
                    <select id="assignee-${escapeHTML(t.id)}" name="assignee-${escapeHTML(t.id)}" class="native-select-hidden table-select inline-assignee multi-assignee-select" aria-label="Cambiar asignación (hasta 3 personas)" data-color="${escapeHTML(colorHex)}" data-action="change-assignee" data-task-id="${escapeHTML(t.id)}" multiple>
                        ${assigneeOpts}
                    </select>
                </td>
                <td class="date-info" data-label="Fechas">
                    <span class="date-req"><span class="date-label">Recibida</span> ${t.dateReceived ? t.dateReceived.split('-').reverse().join('/') : 'N/A'}</span>
                    <div class="deadline-control">
                        <span class="date-label date-label-primary">${t.status === 'Entregado' ? 'Entregada' : 'Fecha límite'}</span>
                        <input type="text" id="delivery-date-${taskId}" name="delivery-date-${taskId}" class="inline-date-picker ${dateClass}" data-id="${taskId}" aria-label="${t.status === 'Entregado' ? 'Fecha de entrega' : 'Cambiar fecha límite'}" data-received="${escapeHTML(t.dateReceived || "")}" value="${dateDeliveredVal}" placeholder="Seleccionar" ${t.status === 'Entregado' ? 'disabled' : ''}>
                    </div>
                </td>
                <td class="status-cell" data-label="Estado">${statusButtons}</td>
                <td class="actions-cell" data-label="Acciones">
                    <div class="action-buttons">
                        <button type="button" class="btn-icon task-notes-button ${t.notes ? 'has-notes' : ''}" aria-label="${t.notes ? 'Ver notas de la solicitud' : 'Ver notas de la solicitud (sin notas)'}" title="${t.notes ? 'Ver notas' : 'Sin notas'}" data-action="view-task-notes" data-task-id="${taskId}"><i data-lucide="message-square-text" aria-hidden="true"></i>${t.notes ? '<span class="task-notes-dot" aria-hidden="true"></span>' : ''}</button>
                        <button type="button" class="btn-icon" aria-label="Ver historial de la solicitud" title="Ver historial" data-action="view-task-history" data-task-id="${taskId}"><i data-lucide="history" aria-hidden="true"></i></button>
                        <div class="row-actions-menu">
                            <button type="button" class="btn-icon row-menu-trigger" aria-label="Más acciones" title="Más acciones" aria-expanded="false" data-action="toggle-row-menu" data-task-id="${taskId}"><i data-lucide="more-horizontal" aria-hidden="true"></i></button>
                            <div class="row-actions-popover" role="menu" hidden>
                                <button type="button" class="row-menu-item" role="menuitem" data-action="edit-task" data-task-id="${taskId}"><i data-lucide="edit-3" aria-hidden="true"></i><span>Editar solicitud</span></button>
                                <button type="button" class="row-menu-item is-danger" role="menuitem" data-action="delete-task" data-task-id="${taskId}"><i data-lucide="trash-2" aria-hidden="true"></i><span>Eliminar solicitud</span></button>
                            </div>
                        </div>
                    </div>
                </td>
            `;
            const rowAssigneeSelect = tr.querySelector('.multi-assignee-select');
            if (rowAssigneeSelect) {
                const currentAssignees = new Set(normalizeAssignees(t.assignee));
                Array.from(rowAssigneeSelect.options).forEach(option => {
                    option.selected = currentAssignees.has(option.value);
                });
            }
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

        if (this.animateNextBoardRender) {
            const mode = this.animateNextBoardRender;
            this.animateNextBoardRender = null;
            requestAnimationFrame(() => {
                const rows = [...tBody.querySelectorAll('tr[data-task-row]')];
                rows.forEach((row, index) => {
                    row.classList.add(mode === 'filter' ? 'task-row-filter-enter' : 'task-row-enter');
                    row.style.setProperty('--dh-row-delay', `${Math.min(index, 6) * 24}ms`);
                });
            });
        }

        buildCustomSelects(document);
        
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
            const assignees = normalizeAssignees(task.assignee);
            if (!assignees.length) {
                workload['No asignado'] = (workload['No asignado'] || 0) + 1;
                return;
            }
            assignees.forEach(assignee => {
                workload[assignee] = (workload[assignee] || 0) + 1;
            });
        });

        const sortedWorkload = Object.entries(workload)
            .filter(([, count]) => count > 0)
            .sort((a, b) => {
                // Sin asignar siempre queda primero: representa trabajo que requiere atención.
                if (a[0] === 'No asignado' && b[0] !== 'No asignado') return -1;
                if (a[0] !== 'No asignado' && b[0] === 'No asignado') return 1;
                if (b[1] !== a[1]) return b[1] - a[1];
                return a[0].localeCompare(b[0], 'es', { sensitivity: 'base' });
            });

        const maxTasks = sortedWorkload.reduce(
            (max, [, count]) => Math.max(max, count),
            0
        );

        const fragment = document.createDocumentFragment();

        const totalActive = activasTasks.length;
        const unassignedCount = workload['No asignado'] || 0;
        const workloadSummary = document.getElementById('workloadSummary');
        if (workloadSummary) {
            const activeLabel = `${totalActive} tarea${totalActive === 1 ? '' : 's'} activa${totalActive === 1 ? '' : 's'}`;
            const unassignedLabel = unassignedCount > 0 ? ` · ${unassignedCount} sin asignar` : '';
            workloadSummary.textContent = `${activeLabel}${unassignedLabel}`;
            workloadSummary.classList.toggle('has-unassigned', unassignedCount > 0);
        }

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

            // La barra representa distribución relativa de tareas, no porcentaje de capacidad.
            const percentage = maxTasks === 0 ? 0 : (count / maxTasks) * 100;
            const color = this.getColor(name);

            const item = document.createElement('div');
            item.className = `workload-item workload-item-interactive ${name === 'No asignado' ? 'is-unassigned' : ''}`;
            item.dataset.workloadFilter = name;
            if (document.getElementById('filterAssignee')?.value === name) item.classList.add('is-filtered');
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', `Filtrar tareas asignadas a ${normalizeText(name)}: ${count}. La barra representa distribución relativa de tareas.`);

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

/* V37.5.9 — navegación accesible al Home */
document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-nav-home="true"]');
    if (!trigger) return;
    event.preventDefault();
    window.location.hash = '#home';
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
