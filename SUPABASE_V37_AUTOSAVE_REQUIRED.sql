-- DESIGN HUB V37 — AUTOSAVE (REQUERIDO PARA SINCRONIZACIÓN COMPLETA)
-- Este script es específico para la tabla public.tasks existente en V36.9.
-- No elimina ni modifica datos históricos de forma destructiva.
-- EJECUTAR SOLO DESPUÉS DE REVISARLO.

begin;

-- 1) Metadatos necesarios para fecha límite, fecha real de entrega y concurrencia.
alter table public.tasks
    add column if not exists due_at timestamptz;

alter table public.tasks
    add column if not exists delivered_at timestamptz;

alter table public.tasks
    add column if not exists version bigint not null default 1;

alter table public.tasks
    add column if not exists updated_at timestamptz not null default now();

-- 2) Conserva la fecha límite que ya existe en dateDelivered para tareas activas.
update public.tasks
set due_at = (dateDelivered || 'T12:00:00')::timestamptz
where due_at is null
  and status <> 'Entregado'
  and dateDelivered ~ '^\d{4}-\d{2}-\d{2}$';

-- 3) Concurrencia optimista: cada UPDATE incrementa version.
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
for each row
execute function public.design_hub_tasks_touch();

create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_due_at_idx on public.tasks(due_at);
create index if not exists tasks_updated_at_idx on public.tasks(updated_at desc);

commit;
