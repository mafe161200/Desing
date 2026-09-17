-- DESIGN HUB V35
begin;
alter table if exists public.tasks add column if not exists version bigint not null default 1;
alter table if exists public.tasks add column if not exists updated_at timestamptz not null default now();
alter table if exists public.tasks add column if not exists updated_by uuid;
alter table if exists public.tasks add column if not exists assignee_id uuid;
alter table if exists public.tasks add column if not exists requester_id uuid;
alter table if exists public.tasks add column if not exists due_at timestamptz;
alter table if exists public.tasks add column if not exists delivered_at timestamptz;

create table if not exists public.task_events (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    type text not null,
    reason text,
    actor_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists task_events_task_created_idx on public.task_events(task_id, created_at desc);
create index if not exists task_events_type_created_idx on public.task_events(type, created_at desc);

create table if not exists public.task_adjustments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    reason text not null,
    requested_by uuid,
    requested_at timestamptz not null default now(),
    status text not null default 'open',
    resolved_at timestamptz,
    resolved_by uuid
);
create index if not exists task_adjustments_task_idx on public.task_adjustments(task_id, requested_at desc);

create or replace function public.design_hub_tasks_touch()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    new.version = coalesce(old.version,1)+1;
    return new;
end; $$;

drop trigger if exists design_hub_tasks_touch on public.tasks;
create trigger design_hub_tasks_touch before update on public.tasks
for each row execute function public.design_hub_tasks_touch();

create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_assignee_id_idx on public.tasks(assignee_id);
create index if not exists tasks_requester_id_idx on public.tasks(requester_id);
create index if not exists tasks_due_at_idx on public.tasks(due_at);
create index if not exists tasks_updated_at_idx on public.tasks(updated_at desc);
commit;

-- IMPORTANTE: revisar y aplicar RLS/policies según el esquema de Auth real.
-- Las operaciones críticas deben usar UPDATE ... WHERE id=:id AND version=:expected_version.
