-- DESIGN HUB V36 FINAL
-- Migración no destructiva para consolidar concurrencia, auditoría y ajustes.
--
-- IMPORTANTE:
-- 1) Este archivo NO elimina datos ni reemplaza automáticamente las políticas RLS.
-- 2) Antes de ejecutarlo en producción, revisar el esquema real de public.tasks,
--    public.profiles y las policies de Supabase Auth.
-- 3) Si tu instalación ya tiene V34/V35, esta migración intenta conservar ambas
--    convenciones de task_events (type/event_type) para facilitar la transición.

begin;

-- ============================================================
-- 1. CONCURRENCIA / METADATOS DE TASKS
-- ============================================================

do $$
begin
    if to_regclass('public.tasks') is null then
        raise exception 'DH_SCHEMA: no existe public.tasks';
    end if;

    alter table public.tasks
        add column if not exists version bigint not null default 1;

    alter table public.tasks
        add column if not exists updated_at timestamptz not null default now();

    alter table public.tasks
        add column if not exists due_at timestamptz;

    alter table public.tasks
        add column if not exists delivered_at timestamptz;
end $$;

-- updated_by no se fuerza a un tipo concreto porque instalaciones anteriores
-- pueden tenerlo como text o uuid. El frontend lo trata como campo opcional.

create or replace function public.design_hub_tasks_touch()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at := now();
    new.version := coalesce(old.version, 1) + 1;
    return new;
end;
$$;

drop trigger if exists design_hub_tasks_touch on public.tasks;
create trigger design_hub_tasks_touch
before update on public.tasks
for each row execute function public.design_hub_tasks_touch();

create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_due_at_idx on public.tasks(due_at);
create index if not exists tasks_updated_at_idx on public.tasks(updated_at desc);

-- ============================================================
-- 2. EVENTOS DE CICLO DE VIDA
-- ============================================================
-- task_id se mantiene como text para no imponer un tipo físico a tasks.id.
create table if not exists public.task_events (
    id uuid primary key default gen_random_uuid(),
    task_id text not null,
    type text,
    reason text,
    actor_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- Compatibilidad con V34, que utilizaba event_type.
do $$
begin
    if to_regclass('public.task_events') is not null then
        alter table public.task_events add column if not exists type text;
        alter table public.task_events add column if not exists metadata jsonb not null default '{}'::jsonb;

        if exists (
            select 1 from information_schema.columns
            where table_schema='public' and table_name='task_events' and column_name='event_type'
        ) then
            execute 'update public.task_events set type = coalesce(type, event_type) where type is null';
        end if;
    end if;
end $$;

create or replace function public.design_hub_sync_task_event_type()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    -- Esta función usa JSONB para poder convivir con instalaciones que aún
    -- conservan event_type y otras que ya usan type.
    if to_jsonb(new) ? 'type' and to_jsonb(new) ? 'event_type' then
        if (to_jsonb(new)->>'type') is null and (to_jsonb(new)->>'event_type') is not null then
            new.type := to_jsonb(new)->>'event_type';
        elsif (to_jsonb(new)->>'event_type') is null and (to_jsonb(new)->>'type') is not null then
            new.event_type := to_jsonb(new)->>'type';
        end if;
    end if;
    return new;
end;
$$;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='task_events' and column_name='event_type'
    ) then
        execute 'drop trigger if exists design_hub_sync_task_event_type on public.task_events';
        execute 'create trigger design_hub_sync_task_event_type before insert or update on public.task_events for each row execute function public.design_hub_sync_task_event_type()';
    end if;
end $$;

create index if not exists task_events_task_created_idx
    on public.task_events(task_id, created_at desc);
create index if not exists task_events_type_created_idx
    on public.task_events(type, created_at desc);

-- ============================================================
-- 3. AJUSTES COMO ENTIDAD PROPIA
-- ============================================================
create table if not exists public.task_adjustments (
    id uuid primary key default gen_random_uuid(),
    task_id text not null,
    reason text not null,
    requested_by uuid,
    requested_at timestamptz not null default now(),
    status text not null default 'open',
    resolved_at timestamptz,
    resolved_by uuid,
    metadata jsonb not null default '{}'::jsonb
);

alter table public.task_adjustments
    add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists task_adjustments_task_idx
    on public.task_adjustments(task_id, requested_at desc);
create index if not exists idx_task_adjustments_open_task
    on public.task_adjustments(task_id, status, requested_at desc);

-- ============================================================
-- 4. HISTORIAL GENERAL EXISTENTE
-- ============================================================
-- Se conserva task_change_history porque el frontend actual lo utiliza.
-- Solo se crea si no existe; no se borran registros anteriores.
create table if not exists public.task_change_history (
    id bigint generated by default as identity primary key,
    task_id text not null,
    operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
    before_data jsonb,
    after_data jsonb,
    changed_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists task_change_history_created_idx
    on public.task_change_history(created_at desc);
create index if not exists task_change_history_task_created_idx
    on public.task_change_history(task_id, created_at desc);

create or replace function public.log_task_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.task_change_history(task_id, operation, before_data, after_data, changed_by)
        values(new.id::text, 'INSERT', null, to_jsonb(new), auth.uid());
        return new;
    elsif tg_op = 'UPDATE' then
        insert into public.task_change_history(task_id, operation, before_data, after_data, changed_by)
        values(new.id::text, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
        return new;
    elsif tg_op = 'DELETE' then
        insert into public.task_change_history(task_id, operation, before_data, after_data, changed_by)
        values(old.id::text, 'DELETE', to_jsonb(old), null, auth.uid());
        return old;
    end if;
    return null;
end;
$$;

drop trigger if exists trg_tasks_change_history on public.tasks;
create trigger trg_tasks_change_history
after insert or update or delete on public.tasks
for each row execute function public.log_task_change();

-- ============================================================
-- 5. RESTAURACIÓN CON CONCURRENCIA OPTIMISTA
-- ============================================================
-- p_task_id es text para aceptar uuid/text/int convertidos por el frontend.
-- Las fechas se reciben como text porque el esquema histórico no fue entregado
-- completo y puede usar date, text o timestamptz. PostgreSQL hará el cast apropiado
-- al asignar el valor al tipo físico de la columna.
create or replace function public.design_hub_restore_task(
    p_task_id text,
    p_expected_version bigint,
    p_name text,
    p_requester text,
    p_assignee text,
    p_status text,
    p_date_received text,
    p_date_delivered text,
    p_notes text
)
returns table (
    id text,
    version bigint,
    updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
begin
    return query
    update public.tasks t
       set name = p_name,
           requester = p_requester,
           assignee = p_assignee,
           status = p_status,
           date_received = nullif(p_date_received, ''),
           date_delivered = nullif(p_date_delivered, ''),
           notes = p_notes
     where t.id::text = p_task_id
       and t.version = p_expected_version
     returning t.id::text, t.version, t.updated_at;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'DH_CONFLICT: la tarea cambió antes de restaurar la versión';
    end if;
end;
$$;

create index if not exists task_events_task_created_idx_v36
    on public.task_events(task_id, created_at desc);

-- ============================================================
-- 6. RLS: SOLO HABILITAR, NO INVENTAR POLÍTICAS
-- ============================================================
-- Las policies definitivas dependen de los roles reales de Supabase Auth.
-- Se habilita RLS para evitar dejar tablas nuevas expuestas por accidente;
-- las policies deben crearse explícitamente según el modelo real antes de usar
-- estas tablas desde el frontend.
alter table public.task_events enable row level security;
alter table public.task_adjustments enable row level security;
alter table public.task_change_history enable row level security;

commit;

-- ============================================================
-- VALIDACIÓN MANUAL RECOMENDADA
-- ============================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema='public' and table_name='tasks'
-- order by ordinal_position;
--
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname='public'
--   and tablename in ('tasks','profiles','task_events','task_adjustments','task_change_history');
--
-- Revisar las policies reales en Supabase antes de producción.
