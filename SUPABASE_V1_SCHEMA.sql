-- Design Hub V1 — esquema base.
-- No ejecutar sobre producción sin revisar el esquema existente y las políticas RLS.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','production_design','finance')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references public.clients(id) on delete set null,
  requester_id uuid references public.profiles(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'En cola' check (status in ('En cola','En curso','Ajustes','Entregada')),
  priority text not null default 'Normal' check (priority in ('Normal','Alta','Urgente')),
  received_at timestamptz not null default now(),
  due_at timestamptz,
  delivered_at timestamptz,
  notes text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  type text not null,
  detail text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  invoice_number text,
  status text not null default 'Borrador' check (status in ('Borrador','Emitida','Pagada','Vencida','Anulada')),
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (subtotal + tax) stored,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requests_status on public.requests(status);
create index if not exists idx_requests_assignee on public.requests(assignee_id);
create index if not exists idx_requests_client on public.requests(client_id);
create index if not exists idx_requests_due on public.requests(due_at);
create index if not exists idx_events_request on public.task_events(request_id, created_at desc);
create index if not exists idx_invoices_client on public.invoices(client_id);
create index if not exists idx_invoices_status on public.invoices(status);

-- IMPORTANTE:
-- Las políticas RLS no se inventan aquí porque deben ajustarse a las reglas
-- reales de acceso de la instancia Supabase. Antes de producción:
-- 1) activar RLS;
-- 2) definir permisos por rol;
-- 3) impedir que el frontend otorgue privilegios por sí mismo;
-- 4) validar acceso de finanzas a clientes/facturación;
-- 5) validar acceso de producción/diseño a solicitudes y entregables.
