-- DESIGN HUB V34
-- Migración de robustez de datos.
-- IMPORTANTE: este archivo NO reemplaza las políticas RLS existentes.
-- Revísalo en el SQL Editor de la instancia real antes de ejecutarlo.

begin;

-- ============================================================
-- 1. Control de concurrencia en tasks
-- ============================================================
-- Se agregan solo si no existen. Esto permite que el frontend V34
-- funcione también durante una transición desde el esquema anterior.

do $$
begin
    if to_regclass('public.tasks') is not null then
        alter table public.tasks
            add column if not exists version integer not null default 1;

        alter table public.tasks
            add column if not exists updated_at timestamptz not null default now();

        alter table public.tasks
            add column if not exists updated_by text;
    end if;
end $$;

-- Trigger: cada actualización aumenta la versión y registra el actor
-- autenticado cuando Supabase dispone de auth.uid().
do $$
begin
    if to_regclass('public.tasks') is not null then
        create or replace function public.design_hub_tasks_touch_version()
        returns trigger
        language plpgsql
        security invoker
        set search_path = public
        as $fn$
        begin
            new.version := coalesce(old.version, 0) + 1;
            new.updated_at := now();
            begin
                new.updated_by := auth.uid()::text;
            exception when others then
                -- Permite ejecutar la migración en un PostgreSQL donde auth.uid()
                -- no esté disponible. En Supabase real el valor se registra.
                new.updated_by := coalesce(new.updated_by, old.updated_by);
            end;
            return new;
        end;
        $fn$;

        drop trigger if exists trg_design_hub_tasks_touch_version on public.tasks;
        create trigger trg_design_hub_tasks_touch_version
            before update on public.tasks
            for each row
            execute function public.design_hub_tasks_touch_version();

        create index if not exists idx_design_hub_tasks_updated_at
            on public.tasks (updated_at desc);
    end if;
end $$;

-- ============================================================
-- 2. Eventos de ciclo de vida / auditoría
-- ============================================================
-- task_id se deja como text deliberadamente para no asumir el tipo
-- físico de tasks.id de una instalación existente.
create table if not exists public.task_events (
    id uuid primary key default gen_random_uuid(),
    task_id text not null,
    event_type text not null,
    reason text,
    actor_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint task_events_event_type_check check (
        event_type in (
            'CREATED',
            'STARTED',
            'DELIVERED',
            'ADJUSTMENT_REQUESTED',
            'ADJUSTMENT_STARTED',
            'REDELIVERED',
            'ASSIGNED',
            'UNASSIGNED',
            'UPDATED',
            'DELETED'
        )
    )
);

create index if not exists idx_design_hub_task_events_task_created
    on public.task_events (task_id, created_at desc);

create index if not exists idx_design_hub_task_events_type_created
    on public.task_events (event_type, created_at desc);

-- ============================================================
-- 3. Ajustes como entidad propia
-- ============================================================
create table if not exists public.task_adjustments (
    id uuid primary key default gen_random_uuid(),
    task_id text not null,
    reason text not null,
    requested_by text,
    requested_at timestamptz not null default now(),
    resolved_at timestamptz,
    resolved_by text,
    status text not null default 'open',
    metadata jsonb not null default '{}'::jsonb,
    constraint task_adjustments_status_check check (
        status in ('open', 'in_progress', 'resolved', 'cancelled')
    )
);

create index if not exists idx_design_hub_task_adjustments_task_requested
    on public.task_adjustments (task_id, requested_at desc);

-- ============================================================
-- 4. NOTAS DE SEGURIDAD / RLS
-- ============================================================
-- No se crean DROP/CREATE POLICY automáticos aquí porque no conocemos
-- las políticas actuales de la instancia. Antes de producción, comprobar:
--
--   * authenticated puede leer/escribir únicamente lo permitido.
--   * anon no puede leer ni modificar datos privados.
--   * las acciones administrativas se validan en la base de datos.
--   * task_events y task_adjustments tienen RLS habilitado y policies
--     explícitas antes de exponerlas desde el frontend.
--
-- Ejemplo de comprobación manual:
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and tablename in ('tasks','profiles','requesters','notes',
--                     'task_change_history','task_events','task_adjustments');

commit;
