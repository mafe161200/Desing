/* ============================================================
   DESIGN HUB — APP.JS
   V6.2 — Historial general de cambios
   ============================================================ */

'use strict';

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

const SUPABASE_URL = 'https://gbltrfqxohrmkopanghx.supabase.co';
const SUPABASE_ANON_KEY = 'REEMPLAZAR_CON_TU_PUBLISHABLE_KEY';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */

const App = {
    currentUser: null,
    profile: null,
    members: [],
    requesters: [],
    tasks: [],
    notes: [],
    changeHistory: [],

    filters: {
        search: '',
        status: 'Todos'
    },

    historyFilters: {
        search: '',
        status: 'Todos',
        from: '',
        to: ''
    },

    changeHistoryFilters: {
        search: '',
        from: '',
        to: '',
        user: 'Todos',
        operation: 'Todos'
    },

    currentView: 'board',

    realtimeChannels: [],

    editingTaskId: null,
    cropper: null,
    cropFileData: null,

    initialized: false
};

/* ============================================================
   UTILIDADES
   ============================================================ */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const escapeHTML = (value) => {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
};

const normalizeText = (value) =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const formatDate = (value) => {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

const formatDateTime = (value) => {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const dateValue = (value) => {
    if (!value) return Number.MAX_SAFE_INTEGER;

    const date = new Date(value);
    const time = date.getTime();

    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

const todayStart = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const isOverdue = (task) => {
    if (!task || task.status === 'Entregado') return false;

    if (!task.dateDue) return false;

    return dateValue(task.dateDue) < todayStart().getTime();
};

const getInitials = (name) => {
    const clean = String(name || '').trim();

    if (!clean) return '?';

    const parts = clean.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getMemberById = (id) =>
    App.members.find(member => String(member.id) === String(id));

const getMemberByName = (name) =>
    App.members.find(member => normalizeText(member.name) === normalizeText(name));

const getRequesterById = (id) =>
    App.requesters.find(requester => String(requester.id) === String(id));

const getRequesterName = (id) => {
    const requester = getRequesterById(id);
    return requester?.name || 'Sin solicitante';
};

const getMemberName = (id) => {
    const member = getMemberById(id);
    return member?.name || 'Sin asignar';
};

const getCurrentUserName = () =>
    App.profile?.name ||
    App.currentUser?.email?.split('@')[0] ||
    'Usuario';

const isAdmin = () =>
    App.profile?.role === 'admin';

const isEditor = () =>
    App.profile?.role === 'editor' || isAdmin();

const showToast = (message, type = 'info') => {
    const container = $('#toastContainer');

    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconName = {
        success: 'check-circle-2',
        error: 'circle-alert',
        warning: 'triangle-alert',
        info: 'info'
    }[type] || 'info';

    toast.innerHTML = `
        <i data-lucide="${iconName}" aria-hidden="true"></i>
        <span>${escapeHTML(message)}</span>
    `;

    container.appendChild(toast);

    if (window.lucide) {
        window.lucide.createIcons();
    }

    window.setTimeout(() => {
        toast.classList.add('toast-hide');

        window.setTimeout(() => {
            toast.remove();
        }, 250);
    }, 3500);
};

const handleSupabaseError = (error, fallbackMessage = 'No fue posible completar la operación.') => {
    console.error(error);

    const message =
        error?.message ||
        error?.details ||
        error?.hint ||
        fallbackMessage;

    showToast(message, 'error');
};

const debounce = (callback, delay = 250) => {
    let timeout;

    return (...args) => {
        window.clearTimeout(timeout);

        timeout = window.setTimeout(() => {
            callback(...args);
        }, delay);
    };
};

/* ============================================================
   ORDEN DE TAREAS
   Prioridad primero.
   Después: fecha de recepción más antigua.
   ============================================================ */

const sortTasks = (a, b) => {
    if (a.isStarred && !b.isStarred) return -1;

    if (!a.isStarred && b.isStarred) return 1;

    const receivedDiff =
        dateValue(a.dateReceived) -
        dateValue(b.dateReceived);

    if (receivedDiff !== 0) {
        return receivedDiff;
    }

    const deliveryDiff =
        dateValue(a.dateDelivered) -
        dateValue(b.dateDelivered);

    if (deliveryDiff !== 0) {
        return deliveryDiff;
    }

    return String(a.id).localeCompare(String(b.id));
};

/* ============================================================
   DATA SERVICE
   ============================================================ */

const DataService = {

    async getCurrentUser() {
        const { data, error } =
            await supabaseClient.auth.getUser();

        if (error) throw error;

        return data?.user || null;
    },

    async getProfile(userId) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;

        return data;
    },

    async getMembers() {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return data || [];
    },

    async getRequesters() {
        const { data, error } = await supabaseClient
            .from('requesters')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return data || [];
    },

    async getTasks() {
        const { data, error } = await supabaseClient
            .from('tasks')
            .select('*');

        if (error) throw error;

        return data || [];
    },

    async getNotes() {
        const { data, error } = await supabaseClient
            .from('notes')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        return data || [];
    },

    async getChangeHistory(limit = 300) {
        const { data, error } = await supabaseClient
            .from('task_change_history')
            .select(`
                id,
                task_id,
                operation,
                before_data,
                after_data,
                changed_by,
                created_at
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return data || [];
    },

    async createTask(payload) {
        const { data, error } = await supabaseClient
            .from('tasks')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    async updateTask(id, payload) {
        const { data, error } = await supabaseClient
            .from('tasks')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    async deleteTask(id) {
        const { error } = await supabaseClient
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async createRequester(name) {
        const { data, error } = await supabaseClient
            .from('requesters')
            .insert({
                name
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    async deleteRequester(id) {
        const { error } = await supabaseClient
            .from('requesters')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async updateProfile(userId, payload) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .update(payload)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    async restoreTaskVersion(taskId, version) {
        if (!version) {
            throw new Error('No existe una versión anterior para restaurar.');
        }

        const payload = normalizeTaskPayload(version);

        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;

        return this.updateTask(taskId, payload);
    }
};

/* ============================================================
   NORMALIZACIÓN
   ============================================================ */

const normalizeTask = (task) => ({
    ...task,

    id: task.id,

    title:
        task.title ??
        task.name ??
        'Sin título',

    requester:
        task.requester ??
        task.requester_id ??
        task.requesterId ??
        '',

    assigned:
        task.assigned ??
        task.assigned_to ??
        task.assignedTo ??
        '',

    status:
        task.status ||
        'En cola',

    dateReceived:
        task.dateReceived ??
        task.date_received ??
        null,

    dateDue:
        task.dateDue ??
        task.date_due ??
        null,

    dateDelivered:
        task.dateDelivered ??
        task.date_delivered ??
        null,

    notes:
        task.notes ??
        '',

    isStarred:
        Boolean(
            task.isStarred ??
            task.is_starred ??
            false
        )
});

const normalizeTaskPayload = (task) => ({
    title: String(task.title || '').trim(),

    requester: task.requester || null,

    assigned: task.assigned || null,

    status: task.status || 'En cola',

    dateReceived: task.dateReceived || null,

    dateDue: task.dateDue || null,

    dateDelivered:
        task.status === 'Entregado'
            ? (task.dateDelivered || new Date().toISOString())
            : null,

    notes: String(task.notes || ''),

    isStarred: Boolean(task.isStarred)
});

/* ============================================================
   CARGA PRINCIPAL
   ============================================================ */

async function loadData() {
    setConnectionStatus('loading');

    try {
        const [
            members,
            requesters,
            tasks,
            notes
        ] = await Promise.all([
            DataService.getMembers(),
            DataService.getRequesters(),
            DataService.getTasks(),
            DataService.getNotes()
        ]);

        App.members = members || [];
        App.requesters = requesters || [];
        App.tasks = (tasks || []).map(normalizeTask);
        App.notes = notes || [];

        renderAll();

        setConnectionStatus('connected');

        if (App.currentView === 'change-history') {
            await loadChangeHistory();
        }

    } catch (error) {
        setConnectionStatus('error');
        handleSupabaseError(
            error,
            'No fue posible cargar los datos del workspace.'
        );
    }
}

/* ============================================================
   ESTADO DE CONEXIÓN
   ============================================================ */

function setConnectionStatus(state) {
    const wrapper = $('#connectionStatus');
    const text = $('#statusText');

    if (!wrapper || !text) return;

    wrapper.classList.remove(
        'status-loading',
        'status-connected',
        'status-error'
    );

    if (state === 'connected') {
        wrapper.classList.add('status-connected');
        text.textContent = 'Sincronizado';
        return;
    }

    if (state === 'error') {
        wrapper.classList.add('status-error');
        text.textContent = 'Error de conexión';
        return;
    }

    wrapper.classList.add('status-loading');
    text.textContent = 'Sincronizando...';
}

/* ============================================================
   RENDER GENERAL
   ============================================================ */

function renderAll() {
    updateCurrentUserUI();
    renderSidebar();
    renderTaskBoard();
    renderSummary();
    renderWorkload();
    renderRequesterOptions();
    renderAssignedOptions();
    renderMembers();
    renderRequesters();

    if (App.currentView === 'history') {
        renderHistory();
    }

    if (App.currentView === 'change-history') {
        renderChangeHistory();
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/* ============================================================
   USUARIO
   ============================================================ */

function updateCurrentUserUI() {
    const nameElement = $('#currentUserName');
    const avatar = $('#userAvatar');

    const name = getCurrentUserName();

    if (nameElement) {
        nameElement.textContent = name;
    }

    if (avatar) {
        const avatarUrl =
            App.profile?.avatar_url ||
            App.profile?.avatarUrl ||
            '';

        if (avatarUrl) {
            avatar.src = avatarUrl;
            avatar.alt = `Avatar de ${name}`;
        } else {
            avatar.src =
                `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
                        <rect width="96" height="96" rx="48" fill="${App.profile?.color || '#4f46e5'}"/>
                        <text x="48" y="58" text-anchor="middle"
                              font-family="Montserrat, sans-serif"
                              font-size="32"
                              font-weight="700"
                              fill="#ffffff">${getInitials(name)}</text>
                    </svg>
                `)}`;

            avatar.alt = `Iniciales de ${name}`;
        }
    }

    $$('.admin-only').forEach(element => {
        element.style.display = isAdmin() ? '' : 'none';
    });
}

/* ============================================================
   RESUMEN
   ============================================================ */

function renderSummary() {
    const activeTasks =
        App.tasks.filter(task => task.status !== 'Entregado');

    const course =
        App.tasks.filter(task => task.status === 'En curso');

    const queue =
        App.tasks.filter(task => task.status === 'En cola');

    const overdue =
        App.tasks.filter(task => isOverdue(task));

    const starred =
        activeTasks.filter(task => task.isStarred);

    setText('#summaryTotal', activeTasks.length);
    setText('#summaryCourse', course.length);
    setText('#summaryQueue', queue.length);
    setText('#summaryOverdue', overdue.length);
    setText('#summaryStarred', starred.length);
}

function setText(selector, value) {
    const element = $(selector);

    if (element) {
        element.textContent = String(value);
    }
}

/* ============================================================
   SIDEBAR
   ============================================================ */

function renderSidebar() {
    const list = $('#sidebarList');

    if (!list) return;

    const currentUserId = App.currentUser?.id;

    const myTasks = App.tasks
        .filter(task =>
            String(task.assigned) === String(currentUserId)
        )
        .filter(task => task.status !== 'Entregado')
        .sort(sortTasks);

    const badge = document.querySelector(
        '.sidebar-card:first-child .badge-count'
    );

    if (badge) {
        badge.textContent = myTasks.length;
    }

    if (!myTasks.length) {
        list.innerHTML = `
            <li class="request-list-empty">
                <i data-lucide="check-check" aria-hidden="true"></i>
                <span>No tienes tareas activas.</span>
            </li>
        `;

        if (window.lucide) {
            window.lucide.createIcons();
        }

        return;
    }

    list.innerHTML = myTasks.map(task => {
        const statusClass = statusClassName(task.status);

        return `
            <li class="request-list-item">
                <button
                    type="button"
                    class="sidebar-task-button"
                    data-task-focus="${escapeHTML(task.id)}"
                    aria-label="Abrir solicitud ${escapeHTML(task.title)}"
                >
                    <span class="sidebar-task-main">
                        <strong>${escapeHTML(task.title)}</strong>
                        <small>${escapeHTML(getRequesterName(task.requester))}</small>
                    </span>
                    <span class="status-pill ${statusClass}">
                        ${escapeHTML(task.status)}
                    </span>
                </button>
            </li>
        `;
    }).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/* ============================================================
   TABLERO
   ============================================================ */

function getFilteredTasks() {
    const search = normalizeText(App.filters.search);
    const status = App.filters.status;

    return App.tasks
        .filter(task => {
            if (status !== 'Todos' && task.status !== status) {
                return false;
            }

            if (!search) return true;

            const searchable = [
                task.title,
                getRequesterName(task.requester),
                getMemberName(task.assigned),
                task.notes
            ]
                .map(normalizeText)
                .join(' ');

            return searchable.includes(search);
        })
        .sort(sortTasks);
}

function renderTaskBoard() {
    const board = $('#taskBoard');
    const empty = $('#emptyBoard');

    if (!board) return;

    const tasks = getFilteredTasks();

    if (!tasks.length) {
        board.innerHTML = '';

        if (empty) {
            empty.style.display = '';
        }

        return;
    }

    if (empty) {
        empty.style.display = 'none';
    }

    board.innerHTML = tasks
        .map(renderTaskCard)
        .join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function renderTaskCard(task) {
    const assignedName = getMemberName(task.assigned);
    const requesterName = getRequesterName(task.requester);
    const overdue = isOverdue(task);

    const statusClass = statusClassName(task.status);

    const starClass = task.isStarred
        ? 'task-star-active'
        : '';

    const deliveryText =
        task.status === 'Entregado'
            ? formatDate(task.dateDelivered)
            : formatDate(task.dateDue);

    return `
        <article
            class="task-card ${overdue ? 'task-card-overdue' : ''}"
            data-task-id="${escapeHTML(task.id)}"
        >
            <div class="task-card-top">
                <div class="task-card-title-wrap">
                    <button
                        type="button"
                        class="task-star-button ${starClass}"
                        data-action="toggle-star"
                        data-task-id="${escapeHTML(task.id)}"
                        aria-label="${task.isStarred ? 'Quitar prioridad' : 'Marcar como prioridad'}"
                        aria-pressed="${task.isStarred ? 'true' : 'false'}"
                        title="${task.isStarred ? 'Quitar prioridad' : 'Marcar como prioridad'}"
                    >
                        <i data-lucide="star" aria-hidden="true"></i>
                    </button>

                    <h3>${escapeHTML(task.title)}</h3>
                </div>

                <span class="status-pill ${statusClass}">
                    ${escapeHTML(task.status)}
                </span>
            </div>

            <div class="task-card-meta">
                <div>
                    <span class="meta-label">Solicitante</span>
                    <strong>${escapeHTML(requesterName)}</strong>
                </div>

                <div>
                    <span class="meta-label">Responsable</span>
                    <strong>${escapeHTML(assignedName)}</strong>
                </div>

                <div>
                    <span class="meta-label">
                        ${task.status === 'Entregado' ? 'Entregada' : 'Entrega'}
                    </span>
                    <strong>${escapeHTML(deliveryText)}</strong>
                </div>
            </div>

            ${
                task.notes
                    ? `
                    <div class="task-notes-preview">
                        <i data-lucide="file-text" aria-hidden="true"></i>
                        <span>${escapeHTML(task.notes)}</span>
                    </div>
                    `
                    : ''
            }

            ${
                overdue
                    ? `
                    <div class="overdue-alert">
                        <i data-lucide="triangle-alert" aria-hidden="true"></i>
                        <span>Solicitud vencida</span>
                    </div>
                    `
                    : ''
            }

            <div class="task-card-actions">
                <button
                    type="button"
                    class="btn btn-secondary"
                    data-action="edit-task"
                    data-task-id="${escapeHTML(task.id)}"
                >
                    <i data-lucide="pencil" aria-hidden="true"></i>
                    Editar
                </button>

                ${
                    task.status !== 'Entregado'
                        ? `
                        <button
                            type="button"
                            class="btn btn-primary"
                            data-action="advance-task"
                            data-task-id="${escapeHTML(task.id)}"
                        >
                            <i data-lucide="arrow-right" aria-hidden="true"></i>
                            ${task.status === 'En cola' ? 'Iniciar' : 'Entregar'}
                        </button>
                        `
                        : ''
                }

                ${
                    isAdmin()
                        ? `
                        <button
                            type="button"
                            class="btn btn-danger-outline"
                            data-action="delete-task"
                            data-task-id="${escapeHTML(task.id)}"
                        >
                            <i data-lucide="trash-2" aria-hidden="true"></i>
                            Eliminar
                        </button>
                        `
                        : ''
                }
            </div>
        </article>
    `;
}

function statusClassName(status) {
    if (status === 'En curso') return 'status-course';
    if (status === 'Entregado') return 'status-delivered';

    return 'status-queue';
}

/* ============================================================
   CARGA DE TRABAJO
   ============================================================ */

function renderWorkload() {
    const container = $('#workloadContainer');

    if (!container) return;

    const activeTasks =
        App.tasks.filter(task => task.status !== 'Entregado');

    if (!App.members.length) {
        container.innerHTML = `
            <div class="workload-empty">
                No hay integrantes registrados.
            </div>
        `;

        return;
    }

    const counts = App.members.map(member => {
        const total =
            activeTasks.filter(task =>
                String(task.assigned) === String(member.id)
            ).length;

        return {
            member,
            total
        };
    });

    const max =
        Math.max(
            ...counts.map(item => item.total),
            1
        );

    container.innerHTML = counts.map(item => {
        const percentage =
            Math.round((item.total / max) * 100);

        return `
            <button
                type="button"
                class="workload-row"
                data-workload-user="${escapeHTML(item.member.id)}"
                aria-label="Filtrar tareas de ${escapeHTML(item.member.name)}"
            >
                <span class="workload-row-header">
                    <span>${escapeHTML(item.member.name)}</span>
                    <strong>${item.total}</strong>
                </span>

                <span class="workload-bar">
                    <span
                        class="workload-bar-fill"
                        style="width:${percentage}%"
                    ></span>
                </span>
            </button>
        `;
    }).join('');
}

/* ============================================================
   OPCIONES SELECT
   ============================================================ */

function renderRequesterOptions() {
    const selects = [
        $('#taskRequester'),
        $('#editRequesterSelect')
    ];

    selects.forEach(select => {
        if (!select) return;

        const currentValue = select.value;

        select.innerHTML = `
            <option value="">Selecciona un solicitante</option>
            ${App.requesters.map(requester => `
                <option value="${escapeHTML(requester.id)}">
                    ${escapeHTML(requester.name)}
                </option>
            `).join('')}
        `;

        if (currentValue) {
            select.value = currentValue;
        }
    });
}

function renderAssignedOptions() {
    const selects = [
        $('#taskAssigned'),
        $('#editAssignedSelect')
    ];

    selects.forEach(select => {
        if (!select) return;

        const currentValue = select.value;

        select.innerHTML = `
            <option value="">Selecciona responsable</option>
            ${App.members.map(member => `
                <option value="${escapeHTML(member.id)}">
                    ${escapeHTML(member.name)}
                </option>
            `).join('')}
        `;

        if (currentValue) {
            select.value = currentValue;
        }
    });
}

/* ============================================================
   TAREAS
   ============================================================ */

async function toggleStar(taskId) {
    const task = App.tasks.find(
        item => String(item.id) === String(taskId)
    );

    if (!task) return;

    try {
        await DataService.updateTask(task.id, {
            isStarred: !task.isStarred
        });

        task.isStarred = !task.isStarred;

        renderAll();

        showToast(
            task.isStarred
                ? 'Solicitud marcada como prioridad.'
                : 'Prioridad retirada.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible actualizar la prioridad.'
        );
    }
}

async function advanceTask(taskId) {
    const task = App.tasks.find(
        item => String(item.id) === String(taskId)
    );

    if (!task) return;

    let status;
    let dateDelivered = task.dateDelivered;

    if (task.status === 'En cola') {
        status = 'En curso';
    } else if (task.status === 'En curso') {
        status = 'Entregado';
        dateDelivered = new Date().toISOString();
    } else {
        return;
    }

    try {
        const updated = await DataService.updateTask(
            task.id,
            {
                status,
                dateDelivered
            }
        );

        Object.assign(task, normalizeTask(updated));

        renderAll();

        showToast(
            status === 'Entregado'
                ? 'Solicitud entregada.'
                : 'Solicitud iniciada.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible actualizar el estado.'
        );
    }
}

async function deleteTask(taskId) {
    if (!isAdmin()) {
        showToast(
            'Solo un administrador puede eliminar solicitudes.',
            'warning'
        );

        return;
    }

    const task = App.tasks.find(
        item => String(item.id) === String(taskId)
    );

    if (!task) return;

    const confirmed = window.confirm(
        `¿Eliminar la solicitud "${task.title}"?\n\nEsta acción quedará registrada en el historial de cambios.`
    );

    if (!confirmed) return;

    try {
        await DataService.deleteTask(task.id);

        App.tasks = App.tasks.filter(
            item => String(item.id) !== String(task.id)
        );

        renderAll();

        showToast(
            'Solicitud eliminada correctamente.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible eliminar la solicitud.'
        );
    }
}

/* ============================================================
   MODAL NUEVA TAREA
   ============================================================ */

async function handleNewTaskSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const title = $('#taskTitle')?.value.trim();
    const requester = $('#taskRequester')?.value;
    const assigned = $('#taskAssigned')?.value;
    const dateReceived = $('#taskDateReceived')?.value;
    const dateDue = $('#taskDateDue')?.value;
    const notes = $('#taskNotes')?.value.trim();

    if (!title || !requester || !assigned || !dateReceived || !dateDue) {
        showToast(
            'Completa los campos obligatorios.',
            'warning'
        );

        return;
    }

    const payload = {
        title,
        requester,
        assigned,
        status: 'En cola',
        dateReceived: parseDateInput(dateReceived),
        dateDue: parseDateInput(dateDue),
        dateDelivered: null,
        notes,
        isStarred: false
    };

    try {
        const created = await DataService.createTask(payload);

        App.tasks.push(normalizeTask(created));

        closeModal('#modalNewTask');

        form.reset();

        renderAll();

        showToast(
            'Solicitud creada correctamente.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible crear la solicitud.'
        );
    }
}

/* ============================================================
   MODAL EDITAR
   ============================================================ */

function openEditTask(taskId) {
    const task = App.tasks.find(
        item => String(item.id) === String(taskId)
    );

    if (!task) return;

    App.editingTaskId = task.id;

    setValue('#editTaskId', task.id);
    setValue('#editTaskTitle', task.title);
    setValue('#editRequesterSelect', task.requester);
    setValue('#editAssignedSelect', task.assigned);
    setValue('#editStatusSelect', task.status);
    setValue('#editDateReceived', formatDateForInput(task.dateReceived));
    setValue('#editDateDue', formatDateForInput(task.dateDue));
    setValue('#editTaskNotes', task.notes);

    openModal('#modalEditTask');
}

async function handleEditTaskSubmit(event) {
    event.preventDefault();

    const taskId = App.editingTaskId;

    if (!taskId) return;

    const task = App.tasks.find(
        item => String(item.id) === String(taskId)
    );

    if (!task) return;

    const title = $('#editTaskTitle')?.value.trim();
    const requester = $('#editRequesterSelect')?.value;
    const assigned = $('#editAssignedSelect')?.value;
    const status = $('#editStatusSelect')?.value;
    const dateReceived = $('#editDateReceived')?.value;
    const dateDue = $('#editDateDue')?.value;
    const notes = $('#editTaskNotes')?.value.trim();

    if (!title || !requester || !assigned || !status || !dateReceived || !dateDue) {
        showToast(
            'Completa los campos obligatorios.',
            'warning'
        );

        return;
    }

    const payload = {
        title,
        requester,
        assigned,
        status,
        dateReceived: parseDateInput(dateReceived),
        dateDue: parseDateInput(dateDue),
        dateDelivered:
            status === 'Entregado'
                ? (
                    task.dateDelivered ||
                    new Date().toISOString()
                )
                : null,
        notes,
        isStarred: task.isStarred
    };

    try {
        const updated =
            await DataService.updateTask(task.id, payload);

        Object.assign(
            task,
            normalizeTask(updated)
        );

        closeModal('#modalEditTask');

        App.editingTaskId = null;

        renderAll();

        showToast(
            'Solicitud actualizada correctamente.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible actualizar la solicitud.'
        );
    }
}

/* ============================================================
   FECHAS
   ============================================================ */

function parseDateInput(value) {
    if (!value) return null;

    const parts = value.split('/');

    if (parts.length === 3) {
        const [day, month, year] = parts;

        const date = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            12,
            0,
            0
        );

        if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
        }
    }

    const fallback = new Date(value);

    return Number.isNaN(fallback.getTime())
        ? null
        : fallback.toISOString();
}

function formatDateForInput(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

function setValue(selector, value) {
    const element = $(selector);

    if (element) {
        element.value = value ?? '';
    }
}

/* ============================================================
   HISTORIAL DE SOLICITUDES REALIZADAS
   ============================================================ */

function getHistoryTasks() {
    const filters = App.historyFilters;

    const search = normalizeText(filters.search);

    return App.tasks
        .filter(task => {
            if (task.status !== 'Entregado') {
                return false;
            }

            if (
                filters.status !== 'Todos' &&
                task.status !== filters.status
            ) {
                return false;
            }

            if (search) {
                const searchable = [
                    task.title,
                    getRequesterName(task.requester),
                    getMemberName(task.assigned),
                    task.notes
                ]
                    .map(normalizeText)
                    .join(' ');

                if (!searchable.includes(search)) {
                    return false;
                }
            }

            if (filters.from) {
                const from =
                    dateValue(parseDateInput(filters.from));

                const delivered =
                    dateValue(task.dateDelivered);

                if (delivered < from) {
                    return false;
                }
            }

            if (filters.to) {
                const toDate =
                    new Date(parseDateInput(filters.to));

                if (!Number.isNaN(toDate.getTime())) {
                    toDate.setHours(23, 59, 59, 999);
                }

                const delivered =
                    dateValue(toDate);

                if (
                    dateValue(task.dateDelivered) >
                    delivered
                ) {
                    return false;
                }
            }

            return true;
        })
        .sort((a, b) =>
            dateValue(b.dateDelivered) -
            dateValue(a.dateDelivered)
        );
}

function renderHistory() {
    const tasks = getHistoryTasks();

    renderHistoryStats(tasks);
    renderHistoryMonthly(tasks);
    renderHistoryTable(tasks);

    const countText =
        `${tasks.length} ${
            tasks.length === 1
                ? 'solicitud'
                : 'solicitudes'
        }`;

    setText('#historyResult', countText);
}

function renderHistoryTable(tasks) {
    const tbody = $('#historyTableBody');
    const empty = $('#historyEmpty');

    if (!tbody) return;

    if (!tasks.length) {
        tbody.innerHTML = '';

        if (empty) {
            empty.style.display = '';
        }

        return;
    }

    if (empty) {
        empty.style.display = 'none';
    }

    tbody.innerHTML = tasks.map(task => `
        <tr>
            <td>
                <strong>${escapeHTML(task.title)}</strong>
            </td>
            <td>${escapeHTML(getRequesterName(task.requester))}</td>
            <td>${escapeHTML(getMemberName(task.assigned))}</td>
            <td>${escapeHTML(formatDate(task.dateReceived))}</td>
            <td>${escapeHTML(formatDate(task.dateDelivered))}</td>
            <td>
                <span class="status-pill status-delivered">
                    Entregado
                </span>
            </td>
        </tr>
    `).join('');
}

function renderHistoryStats(tasks) {
    const total = tasks.length;

    const delivered = tasks.filter(
        task => task.status === 'Entregado'
    ).length;

    const durations = tasks
        .map(task => {
            if (!task.dateReceived || !task.dateDelivered) {
                return null;
            }

            const received =
                dateValue(task.dateReceived);

            const deliveredDate =
                dateValue(task.dateDelivered);

            if (
                received === Number.MAX_SAFE_INTEGER ||
                deliveredDate === Number.MAX_SAFE_INTEGER
            ) {
                return null;
            }

            const diff =
                deliveredDate - received;

            return diff >= 0
                ? diff
                : null;
        })
        .filter(value => value !== null);

    let averageText = '—';

    if (durations.length) {
        const average =
            durations.reduce(
                (sum, value) => sum + value,
                0
            ) / durations.length;

        const days =
            Math.round(
                average / (1000 * 60 * 60 * 24)
            );

        averageText =
            `${days} ${days === 1 ? 'día' : 'días'}`;
    }

    const counts = new Map();

    tasks.forEach(task => {
        const name = getMemberName(task.assigned);

        counts.set(
            name,
            (counts.get(name) || 0) + 1
        );
    });

    let topUser = '—';

    if (counts.size) {
        topUser =
            [...counts.entries()]
                .sort((a, b) => b[1] - a[1])[0][0];
    }

    setText('#historyStatTotal', total);
    setText('#historyStatDelivered', delivered);
    setText('#historyStatAverage', averageText);
    setText('#historyStatTopUser', topUser);
}

function renderHistoryMonthly(tasks) {
    const chart = $('#historyMonthlyChart');
    const summary = $('#historyMonthlySummary');

    if (!chart) return;

    const months = new Map();

    tasks.forEach(task => {
        if (!task.dateDelivered) return;

        const date = new Date(task.dateDelivered);

        if (Number.isNaN(date.getTime())) return;

        const key =
            `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, '0')}`;

        months.set(
            key,
            (months.get(key) || 0) + 1
        );
    });

    const entries =
        [...months.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]));

    if (!entries.length) {
        chart.innerHTML = `
            <div class="history-chart-empty">
                No hay datos para mostrar.
            </div>
        `;

        if (summary) {
            summary.textContent = 'Sin datos';
        }

        return;
    }

    const max =
        Math.max(
            ...entries.map(item => item[1]),
            1
        );

    chart.innerHTML = entries.map(([key, total]) => {
        const [year, month] = key.split('-');

        const date =
            new Date(
                Number(year),
                Number(month) - 1,
                1
            );

        const label =
            new Intl.DateTimeFormat(
                'es-CO',
                { month: 'short', year: 'numeric' }
            ).format(date);

        const percentage =
            Math.round((total / max) * 100);

        return `
            <div class="history-month">
                <div class="history-month-label">
                    <span>${escapeHTML(label)}</span>
                    <strong>${total}</strong>
                </div>

                <div class="history-month-bar">
                    <span
                        style="width:${percentage}%"
                    ></span>
                </div>
            </div>
        `;
    }).join('');

    if (summary) {
        const total =
            entries.reduce(
                (sum, [, value]) => sum + value,
                0
            );

        summary.textContent =
            `${total} ${
                total === 1
                    ? 'entrega'
                    : 'entregas'
            } registradas`;
    }
}

/* ============================================================
   HISTORIAL GENERAL DE CAMBIOS
   ============================================================ */

async function loadChangeHistory() {
    try {
        App.changeHistory =
            await DataService.getChangeHistory();

        populateChangeHistoryUsers();

        renderChangeHistory();

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible cargar el historial de cambios.'
        );
    }
}

function populateChangeHistoryUsers() {
    const select = $('#changeHistoryUser');

    if (!select) return;

    const current =
        App.changeHistoryFilters.user;

    const userIds =
        [...new Set(
            App.changeHistory
                .map(entry => entry.changed_by)
                .filter(Boolean)
        )];

    const users =
        userIds.map(id => ({
            id,
            name: getMemberName(id)
        }));

    select.innerHTML = `
        <option value="Todos">Todos</option>
        ${users
            .sort((a, b) =>
                a.name.localeCompare(
                    b.name,
                    'es',
                    { sensitivity: 'base' }
                )
            )
            .map(user => `
                <option value="${escapeHTML(user.id)}">
                    ${escapeHTML(user.name)}
                </option>
            `)
            .join('')}
    `;

    if (
        current === 'Todos' ||
        users.some(user =>
            String(user.id) === String(current)
        )
    ) {
        select.value = current;
    } else {
        select.value = 'Todos';
        App.changeHistoryFilters.user = 'Todos';
    }
}

function getFilteredChangeHistory() {
    const filters =
        App.changeHistoryFilters;

    const search =
        normalizeText(filters.search);

    return App.changeHistory.filter(entry => {
        if (
            filters.operation !== 'Todos' &&
            entry.operation !== filters.operation
        ) {
            return false;
        }

        if (
            filters.user !== 'Todos' &&
            String(entry.changed_by) !== String(filters.user)
        ) {
            return false;
        }

        const created =
            dateValue(entry.created_at);

        if (filters.from) {
            const from =
                dateValue(
                    parseDateInput(filters.from)
                );

            if (created < from) {
                return false;
            }
        }

        if (filters.to) {
            const parsed =
                parseDateInput(filters.to);

            if (parsed) {
                const to =
                    new Date(parsed);

                to.setHours(23, 59, 59, 999);

                if (
                    created >
                    to.getTime()
                ) {
                    return false;
                }
            }
        }

        if (!search) {
            return true;
        }

        const task =
            App.tasks.find(
                item =>
                    String(item.id) ===
                    String(entry.task_id)
            );

        const userName =
            getMemberName(entry.changed_by);

        const searchable = [
            task?.title || '',
            userName,
            entry.operation,
            describeChange(entry)
        ]
            .map(normalizeText)
            .join(' ');

        return searchable.includes(search);
    });
}

function renderChangeHistory() {
    const tbody = $('#changeHistoryTableBody');
    const empty = $('#changeHistoryEmpty');

    if (!tbody) return;

    const entries =
        getFilteredChangeHistory();

    setText(
        '#changeHistoryCount',
        entries.length
    );

    if (!entries.length) {
        tbody.innerHTML = '';

        if (empty) {
            empty.style.display = '';
        }

        return;
    }

    if (empty) {
        empty.style.display = 'none';
    }

    tbody.innerHTML =
        entries.map(renderChangeHistoryRow).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function renderChangeHistoryRow(entry) {
    const task =
        App.tasks.find(
            item =>
                String(item.id) ===
                String(entry.task_id)
        );

    const title =
        task?.title ||
        getHistoryTaskTitle(entry) ||
        'Solicitud eliminada';

    const userName =
        getMemberName(entry.changed_by);

    const operationLabel =
        operationLabelFor(entry.operation);

    const detail =
        describeChange(entry);

    const canRestore =
        entry.operation === 'UPDATE' &&
        Boolean(entry.before_data);

    return `
        <tr>
            <td>${escapeHTML(formatDateTime(entry.created_at))}</td>

            <td>
                <strong>${escapeHTML(title)}</strong>
            </td>

            <td>
                <span class="change-operation change-${escapeHTML(entry.operation.toLowerCase())}">
                    ${escapeHTML(operationLabel)}
                </span>
            </td>

            <td>${escapeHTML(userName)}</td>

            <td>
                <span class="change-detail">
                    ${escapeHTML(detail)}
                </span>
            </td>

            <td>
                ${
                    canRestore
                        ? `
                        <button
                            type="button"
                            class="btn btn-secondary btn-small"
                            data-action="restore-change"
                            data-history-id="${escapeHTML(entry.id)}"
                        >
                            <i data-lucide="undo-2" aria-hidden="true"></i>
                            Restaurar
                        </button>
                        `
                        : '—'
                }
            </td>
        </tr>
    `;
}

function operationLabelFor(operation) {
    switch (operation) {
        case 'INSERT':
            return 'Creación';

        case 'UPDATE':
            return 'Edición';

        case 'DELETE':
            return 'Eliminación';

        default:
            return operation || 'Cambio';
    }
}

function getHistoryTaskTitle(entry) {
    const source =
        entry.after_data ||
        entry.before_data ||
        {};

    return (
        source.title ||
        source.name ||
        ''
    );
}

function describeChange(entry) {
    if (entry.operation === 'INSERT') {
        return 'Solicitud creada';
    }

    if (entry.operation === 'DELETE') {
        return 'Solicitud eliminada';
    }

    if (entry.operation === 'UPDATE') {
        const before =
            entry.before_data || {};

        const after =
            entry.after_data || {};

        const changes = [];

        const fields = [
            ['title', 'título'],
            ['requester', 'solicitante'],
            ['assigned', 'responsable'],
            ['status', 'estado'],
            ['dateReceived', 'fecha de recepción'],
            ['dateDue', 'fecha de entrega'],
            ['dateDelivered', 'fecha de entrega final'],
            ['notes', 'notas'],
            ['isStarred', 'prioridad']
        ];

        fields.forEach(([field, label]) => {
            const beforeValue =
                before[field] ??
                before[toSnakeCase(field)];

            const afterValue =
                after[field] ??
                after[toSnakeCase(field)];

            if (
                JSON.stringify(beforeValue) !==
                JSON.stringify(afterValue)
            ) {
                changes.push(label);
            }
        });

        if (!changes.length) {
            return 'Solicitud modificada';
        }

        return `Cambió: ${changes.join(', ')}`;
    }

    return 'Cambio registrado';
}

function toSnakeCase(value) {
    return String(value)
        .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

async function restoreChange(historyId) {
    const entry =
        App.changeHistory.find(
            item =>
                String(item.id) ===
                String(historyId)
        );

    if (!entry || !entry.before_data) {
        showToast(
            'No existe información suficiente para restaurar este cambio.',
            'warning'
        );

        return;
    }

    const task =
        App.tasks.find(
            item =>
                String(item.id) ===
                String(entry.task_id)
        );

    const title =
        task?.title ||
        getHistoryTaskTitle(entry) ||
        'esta solicitud';

    const confirmed =
        window.confirm(
            `¿Restaurar "${title}" al estado anterior a este cambio?`
        );

    if (!confirmed) return;

    try {
        const restored =
            await DataService.restoreTaskVersion(
                entry.task_id,
                entry.before_data
            );

        const index =
            App.tasks.findIndex(
                item =>
                    String(item.id) ===
                    String(entry.task_id)
            );

        if (index !== -1) {
            App.tasks[index] =
                normalizeTask(restored);
        }

        await loadChangeHistory();
        renderAll();

        showToast(
            'La solicitud fue restaurada.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible restaurar la solicitud.'
        );
    }
}

/* ============================================================
   MIEMBROS
   ============================================================ */

function renderMembers() {
    const container = $('#membersList');

    if (!container) return;

    container.innerHTML =
        App.members.map(member => `
            <div class="member-tag">
                <span
                    class="member-avatar-small"
                    style="background:${escapeHTML(member.color || '#4f46e5')}"
                >
                    ${escapeHTML(getInitials(member.name))}
                </span>

                <span class="member-tag-name">
                    ${escapeHTML(member.name)}
                </span>

                ${
                    isAdmin() &&
                    String(member.id) !== String(App.currentUser?.id)
                        ? `
                        <button
                            type="button"
                            class="member-delete-button"
                            data-member-id="${escapeHTML(member.id)}"
                            aria-label="Eliminar ${escapeHTML(member.name)}"
                            title="Eliminar integrante"
                        >
                            <i data-lucide="x" aria-hidden="true"></i>
                        </button>
                        `
                        : ''
                }
            </div>
        `).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/*
 * La creación de usuarios de Supabase Auth no debe hacerse
 * desde el navegador con service_role.
 *
 * El botón de administración se mantiene preparado para que
 * el backend / Edge Function de invitaciones gestione el alta.
 */
async function handleAddMember(event) {
    event.preventDefault();

    const input = $('#newMemberInput');

    if (!input) return;

    const name = input.value.trim();

    if (!name) {
        showToast(
            'Escribe el nombre del colaborador.',
            'warning'
        );

        return;
    }

    showToast(
        'La creación de usuarios debe realizarse mediante el flujo seguro de invitación de Supabase Auth.',
        'info'
    );
}

async function deleteMember(memberId) {
    if (!isAdmin()) return;

    const member =
        getMemberById(memberId);

    if (!member) return;

    const confirmed =
        window.confirm(
            `¿Eliminar el perfil de ${member.name}?`
        );

    if (!confirmed) return;

    try {
        const { error } =
            await supabaseClient
                .from('profiles')
                .delete()
                .eq('id', member.id);

        if (error) throw error;

        App.members =
            App.members.filter(
                item =>
                    String(item.id) !==
                    String(member.id)
            );

        renderAll();

        showToast(
            'Perfil eliminado.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible eliminar el perfil.'
        );
    }
}

/* ============================================================
   SOLICITANTES
   ============================================================ */

function renderRequesters() {
    const container = $('#requestersList');

    if (!container) return;

    container.innerHTML =
        App.requesters.map(requester => `
            <div class="member-tag">
                <span class="member-tag-name">
                    ${escapeHTML(requester.name)}
                </span>

                ${
                    isAdmin()
                        ? `
                        <button
                            type="button"
                            class="member-delete-button"
                            data-requester-id="${escapeHTML(requester.id)}"
                            aria-label="Eliminar ${escapeHTML(requester.name)}"
                            title="Eliminar solicitante"
                        >
                            <i data-lucide="x" aria-hidden="true"></i>
                        </button>
                        `
                        : ''
                }
            </div>
        `).join('');

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function handleAddRequester(event) {
    event.preventDefault();

    if (!isAdmin()) return;

    const input = $('#newRequesterInput');

    if (!input) return;

    const name = input.value.trim();

    if (!name) {
        showToast(
            'Escribe el nombre o área.',
            'warning'
        );

        return;
    }

    const exists =
        App.requesters.some(
            requester =>
                normalizeText(requester.name) ===
                normalizeText(name)
        );

    if (exists) {
        showToast(
            'Ese solicitante ya existe.',
            'warning'
        );

        return;
    }

    try {
        const created =
            await DataService.createRequester(name);

        App.requesters.push(created);

        input.value = '';

        renderAll();

        showToast(
            'Solicitante añadido.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible añadir el solicitante.'
        );
    }
}

async function deleteRequester(requesterId) {
    if (!isAdmin()) return;

    const requester =
        getRequesterById(requesterId);

    if (!requester) return;

    const used =
        App.tasks.some(
            task =>
                String(task.requester) ===
                String(requester.id)
        );

    if (used) {
        showToast(
            'No puedes eliminar un solicitante que está asociado a solicitudes existentes.',
            'warning'
        );

        return;
    }

    const confirmed =
        window.confirm(
            `¿Eliminar "${requester.name}"?`
        );

    if (!confirmed) return;

    try {
        await DataService.deleteRequester(
            requester.id
        );

        App.requesters =
            App.requesters.filter(
                item =>
                    String(item.id) !==
                    String(requester.id)
            );

        renderAll();

        showToast(
            'Solicitante eliminado.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible eliminar el solicitante.'
        );
    }
}

/* ============================================================
   PERFIL
   ============================================================ */

function openProfileModal() {
    const profile =
        App.profile;

    if (!profile) return;

    setValue(
        '#avatarUrlInput',
        profile.avatar_url ||
        profile.avatarUrl ||
        ''
    );

    setProfileColor(
        profile.color ||
        '#4f46e5'
    );

    const preview =
        $('#previewAvatar');

    if (preview) {
        const avatar =
            profile.avatar_url ||
            profile.avatarUrl ||
            '';

        preview.src =
            avatar ||
            `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
                    <rect width="120" height="120" rx="60" fill="${profile.color || '#4f46e5'}"/>
                    <text x="60" y="73" text-anchor="middle"
                          font-family="Montserrat, sans-serif"
                          font-size="40"
                          font-weight="700"
                          fill="#fff">${getInitials(profile.name)}</text>
                </svg>
            `)}`;
    }

    openModal('#modalProfile');
}

function setProfileColor(color) {
    $$('.color-swatch').forEach(swatch => {
        const selected =
            normalizeText(
                swatch.dataset.color
            ) === normalizeText(color);

        swatch.classList.toggle(
            'selected',
            selected
        );

        swatch.setAttribute(
            'aria-checked',
            selected ? 'true' : 'false'
        );
    });
}

function getSelectedProfileColor() {
    const selected =
        document.querySelector(
            '.color-swatch.selected'
        );

    return (
        selected?.dataset.color ||
        '#4f46e5'
    );
}

async function handleProfileSubmit(event) {
    event.preventDefault();

    if (!App.currentUser) return;

    const color =
        getSelectedProfileColor();

    const avatarUrl =
        $('#avatarUrlInput')?.value.trim() ||
        null;

    try {
        const updated =
            await DataService.updateProfile(
                App.currentUser.id,
                {
                    color,
                    avatar_url: avatarUrl
                }
            );

        App.profile = updated;

        closeModal('#modalProfile');

        renderAll();

        showToast(
            'Perfil actualizado.',
            'success'
        );

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible actualizar el perfil.'
        );
    }
}

/* ============================================================
   CROP / AVATAR
   ============================================================ */

function handleAvatarFileChange(event) {
    const file =
        event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast(
            'Selecciona una imagen válida.',
            'warning'
        );

        return;
    }

    const reader =
        new FileReader();

    reader.onload = () => {
        const image =
            $('#cropperImage');

        const wrapper =
            $('#cropperWrapper');

        if (!image || !wrapper) return;

        image.src =
            reader.result;

        wrapper.style.display = '';

        if (App.cropper) {
            App.cropper.destroy();
        }

        App.cropper =
            new Cropper(
                image,
                {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 1,
                    responsive: true
                }
            );

        $('#btnCancelCrop').style.display = '';
        $('#fileFieldGroup').style.display = 'none';
        $('#urlFieldGroup').style.display = 'none';
        $('#urlDivider').style.display = 'none';
    };

    reader.readAsDataURL(file);
}

function cancelCrop() {
    if (App.cropper) {
        App.cropper.destroy();
        App.cropper = null;
    }

    const wrapper =
        $('#cropperWrapper');

    if (wrapper) {
        wrapper.style.display = 'none';
    }

    const input =
        $('#avatarFileInput');

    if (input) {
        input.value = '';
    }

    $('#btnCancelCrop').style.display = '';
    $('#fileFieldGroup').style.display = '';
    $('#urlFieldGroup').style.display = '';
    $('#urlDivider').style.display = '';
}

function removeAvatar() {
    setValue('#avatarUrlInput', '');

    const input =
        $('#avatarFileInput');

    if (input) {
        input.value = '';
    }

    cancelCrop();

    const preview =
        $('#previewAvatar');

    if (preview) {
        preview.src =
            `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
                    <rect width="120" height="120" rx="60" fill="${App.profile?.color || '#4f46e5'}"/>
                    <text x="60" y="73" text-anchor="middle"
                          font-family="Montserrat, sans-serif"
                          font-size="40"
                          font-weight="700"
                          fill="#fff">${getInitials(getCurrentUserName())}</text>
                </svg>
            `)}`;
    }
}

/* ============================================================
   NOTAS
   ============================================================ */

function renderNotes() {
    /*
     * El panel de notas se mantiene preparado para el contenido
     * existente. La carga y escritura de notas no debe interferir
     * con el estado de edición de tareas.
     */
}

/* ============================================================
   VISTAS
   ============================================================ */

function showView(view) {
    const boardSection =
        document.querySelector('.board-section');

    const historyView =
        $('#historyView');

    const changeHistoryView =
        $('#changeHistoryView');

    if (boardSection && boardSection !== historyView && boardSection !== changeHistoryView) {
        boardSection.style.display =
            view === 'board'
                ? ''
                : 'none';
    }

    if (historyView) {
        historyView.style.display =
            view === 'history'
                ? ''
                : 'none';
    }

    if (changeHistoryView) {
        changeHistoryView.style.display =
            view === 'change-history'
                ? ''
                : 'none';
    }

    App.currentView = view;

    if (view === 'history') {
        window.location.hash =
            'solicitudes-realizadas';

        renderHistory();
    } else if (view === 'change-history') {
        window.location.hash =
            'historial-cambios';

        loadChangeHistory();
    } else {
        window.location.hash = '';

        renderTaskBoard();
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/* ============================================================
   MODALES
   ============================================================ */

function openModal(selector) {
    const modal = $(selector);

    if (!modal) return;

    modal.classList.add('is-open');

    document.body.classList.add('modal-open');

    const firstInput =
        modal.querySelector(
            'input:not([type="hidden"]), select, textarea, button'
        );

    window.setTimeout(() => {
        firstInput?.focus();
    }, 50);
}

function closeModal(selector) {
    const modal = $(selector);

    if (!modal) return;

    modal.classList.remove('is-open');

    if (!document.querySelector('.modal-overlay.is-open')) {
        document.body.classList.remove('modal-open');
    }
}

function closeAllModals() {
    $$('.modal-overlay.is-open')
        .forEach(modal =>
            modal.classList.remove('is-open')
        );

    document.body.classList.remove('modal-open');
}

/* ============================================================
   FLATPICKR
   ============================================================ */

function initDatePickers() {
    if (typeof flatpickr === 'undefined') {
        return;
    }

    const locale =
        window.flatpickr?.l10ns?.es ||
        undefined;

    $$('.date-picker, .history-date-picker, .change-history-date-picker')
        .forEach(input => {
            if (input._flatpickr) return;

            flatpickr(
                input,
                {
                    locale,
                    dateFormat: 'd/m/Y',
                    allowInput: true,
                    disableMobile: true
                }
            );
        });
}

/* ============================================================
   EVENTOS
   ============================================================ */

function bindEvents() {

    $('#loginForm')?.addEventListener(
        'submit',
        handleLogin
    );

    $('#btnLogout')?.addEventListener(
        'click',
        handleLogout
    );

    $('#togglePasswordBtn')?.addEventListener(
        'click',
        togglePasswordVisibility
    );

    $('#btnNewTask')?.addEventListener(
        'click',
        () => openModal('#modalNewTask')
    );

    $('#newTaskForm')?.addEventListener(
        'submit',
        handleNewTaskSubmit
    );

    $('#editTaskForm')?.addEventListener(
        'submit',
        handleEditTaskSubmit
    );

    $('#btnManageTeam')?.addEventListener(
        'click',
        () => openModal('#modalTeam')
    );

    $('#btnManageReq')?.addEventListener(
        'click',
        () => openModal('#modalRequesters')
    );

    $('#addMemberForm')?.addEventListener(
        'submit',
        handleAddMember
    );

    $('#addRequesterForm')?.addEventListener(
        'submit',
        handleAddRequester
    );

    $('#userProfileBtn')?.addEventListener(
        'click',
        openProfileModal
    );

    $('#userProfileBtn')?.addEventListener(
        'keydown',
        event => {
            if (
                event.key === 'Enter' ||
                event.key === ' '
            ) {
                event.preventDefault();
                openProfileModal();
            }
        }
    );

    $('#profileForm')?.addEventListener(
        'submit',
        handleProfileSubmit
    );

    $('#avatarFileInput')?.addEventListener(
        'change',
        handleAvatarFileChange
    );

    $('#btnCancelCrop')?.addEventListener(
        'click',
        cancelCrop
    );

    $('#btnRemoveAvatar')?.addEventListener(
        'click',
        removeAvatar
    );

    $('#btnToggleNotes')?.addEventListener(
        'click',
        () => {
            showToast(
                'Panel de notas disponible en el workspace.',
                'info'
            );
        }
    );

    $('#btnOpenHistoryBottom')?.addEventListener(
        'click',
        () => showView('history')
    );

    $('#btnBackToBoard')?.addEventListener(
        'click',
        () => showView('board')
    );

    $('#btnOpenChangeHistory')?.addEventListener(
        'click',
        () => showView('change-history')
    );

    $('#btnBackFromChangeHistory')?.addEventListener(
        'click',
        () => showView('board')
    );

    $('#taskSearch')?.addEventListener(
        'input',
        debounce(event => {
            App.filters.search =
                event.target.value;

            renderTaskBoard();
        })
    );

    $('#taskStatusFilter')?.addEventListener(
        'change',
        event => {
            App.filters.status =
                event.target.value;

            renderTaskBoard();
        }
    );

    $('#clearTaskFilters')?.addEventListener(
        'click',
        () => {
            App.filters.search = '';
            App.filters.status = 'Todos';

            setValue('#taskSearch', '');
            setValue('#taskStatusFilter', 'Todos');

            renderTaskBoard();
        }
    );

    $('#historySearch')?.addEventListener(
        'input',
        debounce(event => {
            App.historyFilters.search =
                event.target.value;

            renderHistory();
        })
    );

    $('#historyStatusFilter')?.addEventListener(
        'change',
        event => {
            App.historyFilters.status =
                event.target.value;

            renderHistory();
        }
    );

    $('#historyFrom')?.addEventListener(
        'change',
        event => {
            App.historyFilters.from =
                event.target.value;

            renderHistory();
        }
    );

    $('#historyTo')?.addEventListener(
        'change',
        event => {
            App.historyFilters.to =
                event.target.value;

            renderHistory();
        }
    );

    $('#clearHistoryFilters')?.addEventListener(
        'click',
        () => {
            App.historyFilters = {
                search: '',
                status: 'Todos',
                from: '',
                to: ''
            };

            setValue('#historySearch', '');
            setValue('#historyStatusFilter', 'Todos');
            setValue('#historyFrom', '');
            setValue('#historyTo', '');

            renderHistory();
        }
    );

    $('#changeHistorySearch')?.addEventListener(
        'input',
        debounce(event => {
            App.changeHistoryFilters.search =
                event.target.value;

            renderChangeHistory();
        })
    );

    $('#changeHistoryFrom')?.addEventListener(
        'change',
        event => {
            App.changeHistoryFilters.from =
                event.target.value;

            renderChangeHistory();
        }
    );

    $('#changeHistoryTo')?.addEventListener(
        'change',
        event => {
            App.changeHistoryFilters.to =
                event.target.value;

            renderChangeHistory();
        }
    );

    $('#changeHistoryUser')?.addEventListener(
        'change',
        event => {
            App.changeHistoryFilters.user =
                event.target.value;

            renderChangeHistory();
        }
    );

    $('#changeHistoryOperation')?.addEventListener(
        'change',
        event => {
            App.changeHistoryFilters.operation =
                event.target.value;

            renderChangeHistory();
        }
    );

    $('#clearChangeHistoryFilters')?.addEventListener(
        'click',
        () => {
            App.changeHistoryFilters = {
                search: '',
                from: '',
                to: '',
                user: 'Todos',
                operation: 'Todos'
            };

            setValue('#changeHistorySearch', '');
            setValue('#changeHistoryFrom', '');
            setValue('#changeHistoryTo', '');
            setValue('#changeHistoryUser', 'Todos');
            setValue('#changeHistoryOperation', 'Todos');

            renderChangeHistory();
        }
    );

    $$('.close-modal').forEach(button => {
        button.addEventListener(
            'click',
            () => {
                const modal =
                    button.closest('.modal-overlay');

                if (modal) {
                    closeModal(`#${modal.id}`);
                }
            }
        );
    });

    $$('.modal-overlay').forEach(modal => {
        modal.addEventListener(
            'mousedown',
            event => {
                if (event.target === modal) {
                    closeModal(`#${modal.id}`);
                }
            }
        );
    });

    $$('.color-swatch').forEach(swatch => {
        swatch.addEventListener(
            'click',
            () => {
                setProfileColor(
                    swatch.dataset.color
                );
            }
        );

        swatch.addEventListener(
            'keydown',
            event => {
                if (
                    event.key === 'Enter' ||
                    event.key === ' '
                ) {
                    event.preventDefault();

                    setProfileColor(
                        swatch.dataset.color
                    );
                }
            }
        );
    });

    document.addEventListener(
        'click',
        handleDelegatedClick
    );

    document.addEventListener(
        'keydown',
        handleGlobalKeydown
    );

    $$('.summary-card[data-summary]').forEach(card => {
        const activate = () => {
            const type =
                card.dataset.summary;

            applySummaryFilter(type);
        };

        card.addEventListener(
            'click',
            activate
        );

        card.addEventListener(
            'keydown',
            event => {
                if (
                    event.key === 'Enter' ||
                    event.key === ' '
                ) {
                    event.preventDefault();
                    activate();
                }
            }
        );
    });
}

/* ============================================================
   CLICK DELEGADO
   ============================================================ */

async function handleDelegatedClick(event) {

    const actionElement =
        event.target.closest('[data-action]');

    if (actionElement) {
        const action =
            actionElement.dataset.action;

        const taskId =
            actionElement.dataset.taskId;

        if (action === 'toggle-star') {
            await toggleStar(taskId);
            return;
        }

        if (action === 'edit-task') {
            openEditTask(taskId);
            return;
        }

        if (action === 'advance-task') {
            await advanceTask(taskId);
            return;
        }

        if (action === 'delete-task') {
            await deleteTask(taskId);
            return;
        }

        if (action === 'restore-change') {
            await restoreChange(
                actionElement.dataset.historyId
            );

            return;
        }
    }

    const taskFocus =
        event.target.closest(
            '[data-task-focus]'
        );

    if (taskFocus) {
        const taskId =
            taskFocus.dataset.taskFocus;

        focusTask(taskId);

        return;
    }

    const workload =
        event.target.closest(
            '[data-workload-user]'
        );

    if (workload) {
        const userId =
            workload.dataset.workloadUser;

        App.filters.search = '';

        const assigned =
            getMemberName(userId);

        App.filters.search = assigned;

        setValue(
            '#taskSearch',
            assigned
        );

        renderTaskBoard();

        showToast(
            `Mostrando tareas de ${assigned}.`,
            'info'
        );
    }

    const memberDelete =
        event.target.closest(
            '[data-member-id]'
        );

    if (memberDelete) {
        await deleteMember(
            memberDelete.dataset.memberId
        );

        return;
    }

    const requesterDelete =
        event.target.closest(
            '[data-requester-id]'
        );

    if (requesterDelete) {
        await deleteRequester(
            requesterDelete.dataset.requesterId
        );
    }
}

/* ============================================================
   FILTROS DEL RESUMEN
   ============================================================ */

function applySummaryFilter(type) {

    switch (type) {

        case 'total':
            App.filters.status = 'Todos';
            App.filters.search = '';
            break;

        case 'course':
            App.filters.status = 'En curso';
            App.filters.search = '';
            break;

        case 'queue':
            App.filters.status = 'En cola';
            App.filters.search = '';
            break;

        case 'overdue':
            App.filters.status = 'Todos';
            App.filters.search = '';

            /*
             * Se muestra un filtro temporal mediante
             * la clase del tablero.
             */
            renderTaskBoard();

            const overdueCards =
                $$('.task-card');

            overdueCards.forEach(card => {
                const task =
                    App.tasks.find(
                        item =>
                            String(item.id) ===
                            String(card.dataset.taskId)
                    );

                card.style.display =
                    isOverdue(task)
                        ? ''
                        : 'none';
            });

            return;

        case 'starred':
            App.filters.status = 'Todos';
            App.filters.search = '';

            renderTaskBoard();

            $$('.task-card').forEach(card => {
                const task =
                    App.tasks.find(
                        item =>
                            String(item.id) ===
                            String(card.dataset.taskId)
                    );

                card.style.display =
                    task?.isStarred
                        ? ''
                        : 'none';
            });

            return;
    }

    setValue(
        '#taskSearch',
        App.filters.search
    );

    setValue(
        '#taskStatusFilter',
        App.filters.status
    );

    renderTaskBoard();
}

/* ============================================================
   FOCUS DE TAREA
   ============================================================ */

function focusTask(taskId) {
    showView('board');

    window.setTimeout(() => {
        const card =
            document.querySelector(
                `.task-card[data-task-id="${CSS.escape(String(taskId))}"]`
            );

        if (!card) {
            showToast(
                'La solicitud no está visible con los filtros actuales.',
                'info'
            );

            return;
        }

        card.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        card.classList.add(
            'task-card-focus'
        );

        window.setTimeout(() => {
            card.classList.remove(
                'task-card-focus'
            );
        }, 1800);
    }, 100);
}

/* ============================================================
   LOGIN
   ============================================================ */

async function handleLogin(event) {
    event.preventDefault();

    const username =
        $('#usernameInput')?.value.trim();

    const password =
        $('#passwordInput')?.value;

    const errorElement =
        $('#loginError');

    if (errorElement) {
        errorElement.style.display = 'none';
    }

    if (!username || !password) {
        if (errorElement) {
            errorElement.textContent =
                'Completa usuario y contraseña.';
            errorElement.style.display = '';
        }

        return;
    }

    try {
        const email =
            username.includes('@')
                ? username
                : `${username}@designhub.local`;

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        App.currentUser =
            data.user;

        await initializeAuthenticatedApp();

    } catch (error) {
        console.error(error);

        if (errorElement) {
            errorElement.textContent =
                'Usuario o contraseña incorrectos.';
            errorElement.style.display = '';
        }
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();

        App.currentUser = null;
        App.profile = null;

        teardownRealtime();

        $('#appContainer').style.display = 'none';
        $('#authOverlay').style.display = '';

        closeAllModals();

        setValue('#passwordInput', '');

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible cerrar sesión.'
        );
    }
}

function togglePasswordVisibility() {
    const input =
        $('#passwordInput');

    const button =
        $('#togglePasswordBtn');

    if (!input || !button) return;

    const visible =
        input.type === 'text';

    input.type =
        visible
            ? 'password'
            : 'text';

    button.setAttribute(
        'aria-label',
        visible
            ? 'Mostrar contraseña'
            : 'Ocultar contraseña'
    );

    button.innerHTML =
        `<i data-lucide="${visible ? 'eye' : 'eye-off'}"></i>`;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/* ============================================================
   INICIALIZACIÓN AUTENTICADA
   ============================================================ */

async function initializeAuthenticatedApp() {

    try {
        App.profile =
            await DataService.getProfile(
                App.currentUser.id
            );

        if (!App.profile) {
            throw new Error(
                'No se encontró el perfil del usuario.'
            );
        }

        $('#authOverlay').style.display = 'none';
        $('#appContainer').style.display = '';

        await loadData();

        setupRealtime();

        if (window.location.hash === '#solicitudes-realizadas') {
            showView('history');
        } else if (window.location.hash === '#historial-cambios') {
            showView('change-history');
        } else {
            showView('board');
        }

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible iniciar el workspace.'
        );
    }
}

/* ============================================================
   REALTIME
   ============================================================ */

function teardownRealtime() {
    App.realtimeChannels.forEach(
        channel => {
            supabaseClient.removeChannel(
                channel
            );
        }
    );

    App.realtimeChannels = [];
}

function setupRealtime() {
    teardownRealtime();

    const tasksChannel =
        supabaseClient
            .channel('design-hub-tasks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks'
                },
                payload => {
                    handleRealtimeTaskChange(
                        payload
                    );
                }
            )
            .subscribe();

    const profilesChannel =
        supabaseClient
            .channel('design-hub-profiles')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles'
                },
                payload => {
                    handleRealtimeProfileChange(
                        payload
                    );
                }
            )
            .subscribe();

    const requestersChannel =
        supabaseClient
            .channel('design-hub-requesters')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'requesters'
                },
                async () => {
                    try {
                        App.requesters =
                            await DataService.getRequesters();

                        renderAll();

                    } catch (error) {
                        console.error(error);
                    }
                }
            )
            .subscribe();

    const changeHistoryChannel =
        supabaseClient
            .channel('design-hub-change-history')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'task_change_history'
                },
                async () => {
                    if (
                        App.currentView ===
                        'change-history'
                    ) {
                        await loadChangeHistory();
                    }
                }
            )
            .subscribe();

    App.realtimeChannels.push(
        tasksChannel,
        profilesChannel,
        requestersChannel,
        changeHistoryChannel
    );
}

function handleRealtimeTaskChange(payload) {
    const eventType =
        payload.eventType;

    if (eventType === 'INSERT') {
        const task =
            normalizeTask(
                payload.new
            );

        const exists =
            App.tasks.some(
                item =>
                    String(item.id) ===
                    String(task.id)
            );

        if (!exists) {
            App.tasks.push(task);
        }

    } else if (eventType === 'UPDATE') {
        const task =
            normalizeTask(
                payload.new
            );

        const index =
            App.tasks.findIndex(
                item =>
                    String(item.id) ===
                    String(task.id)
            );

        if (index === -1) {
            App.tasks.push(task);
        } else {
            App.tasks[index] = task;
        }

    } else if (eventType === 'DELETE') {
        const id =
            payload.old?.id;

        App.tasks =
            App.tasks.filter(
                item =>
                    String(item.id) !==
                    String(id)
            );
    }

    renderAll();
}

function handleRealtimeProfileChange(payload) {
    const profile =
        payload.new ||
        payload.old;

    if (!profile?.id) return;

    if (payload.eventType === 'DELETE') {
        App.members =
            App.members.filter(
                member =>
                    String(member.id) !==
                    String(profile.id)
            );
    } else {
        const index =
            App.members.findIndex(
                member =>
                    String(member.id) ===
                    String(profile.id)
            );

        if (index === -1) {
            App.members.push(profile);
        } else {
            App.members[index] =
                profile;
        }

        if (
            String(profile.id) ===
            String(App.currentUser?.id)
        ) {
            App.profile = profile;
        }
    }

    renderAll();
}

/* ============================================================
   ATAJOS Y TECLADO
   ============================================================ */

function handleGlobalKeydown(event) {

    if (event.key === 'Escape') {
        closeAllModals();
        return;
    }

    const isSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k';

    if (isSearchShortcut) {
        event.preventDefault();

        const search =
            App.currentView === 'board'
                ? $('#taskSearch')
                : App.currentView === 'history'
                    ? $('#historySearch')
                    : $('#changeHistorySearch');

        search?.focus();
    }
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

async function init() {

    if (App.initialized) return;

    App.initialized = true;

    bindEvents();

    initDatePickers();

    if (window.lucide) {
        window.lucide.createIcons();
    }

    try {
        const {
            data: {
                session
            }
        } =
            await supabaseClient.auth.getSession();

        if (session?.user) {
            App.currentUser =
                session.user;

            await initializeAuthenticatedApp();

        } else {
            $('#authOverlay').style.display = '';
            $('#appContainer').style.display = 'none';
        }

    } catch (error) {
        handleSupabaseError(
            error,
            'No fue posible inicializar la aplicación.'
        );
    }

    supabaseClient.auth.onAuthStateChange(
        async (_event, session) => {

            if (session?.user) {

                if (
                    !App.currentUser ||
                    String(App.currentUser.id) !==
                    String(session.user.id)
                ) {
                    App.currentUser =
                        session.user;

                    await initializeAuthenticatedApp();
                }

            } else {

                App.currentUser = null;
                App.profile = null;

                teardownRealtime();

                $('#appContainer').style.display =
                    'none';

                $('#authOverlay').style.display =
                    '';
            }
        }
    );
}

document.addEventListener(
    'DOMContentLoaded',
    init
);