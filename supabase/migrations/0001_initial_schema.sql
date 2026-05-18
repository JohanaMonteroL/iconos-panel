-- ============================================
-- ICONOS Panel — Esquema inicial (PRD sección 11)
-- ============================================

create extension if not exists "pgcrypto";

-- ---------- Programadores ----------
create table if not exists programadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slack_id text,
  precio_hora numeric(10,2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Clientes ----------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- ---------- Proyectos ----------
create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  nombre text not null,
  clickup_id text unique,
  precio_hora_venta numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Contactos de correo (muchos por proyecto) ----------
create table if not exists contactos_correo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  nombre_contacto text not null,
  email text not null,
  rol text,
  created_at timestamptz not null default now()
);

-- ---------- Estimaciones del formulario (programadores) ----------
create table if not exists estimaciones_formulario (
  id uuid primary key default gen_random_uuid(),
  programador_id uuid references programadores(id),
  cotizacion_ref uuid,
  datos_raw jsonb not null,
  datos_limpios jsonb,
  ia_recomendacion text,
  estado text not null default 'recibida'
    check (estado in ('recibida','en_revision','procesada','descartada')),
  created_at timestamptz not null default now()
);

-- ---------- Cotizaciones ----------
create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cliente_id uuid references clientes(id),
  proyecto_id uuid references proyectos(id),
  proyecto_clickup_id text,
  canal_entrada text check (canal_entrada in ('whatsapp','correo','llamada','otro','formulario')),
  descripcion_original text,
  descripcion_limpia text,
  programador_id uuid references programadores(id),
  horas_min integer not null default 0,
  horas_max integer not null default 0,
  prioridad text check (prioridad in ('alta','media','baja')),
  estado text not null default 'pendiente_revisar'
    check (estado in (
      'pendiente_revisar','esperando_aprobacion','aprobada',
      'cambios_solicitados','en_desarrollo','enviada_cliente','archivada'
    )),
  clickup_ticket_id text,
  jira_ticket_ids text[],
  estimacion_formulario_id uuid references estimaciones_formulario(id),
  ia_recomendacion text,
  borrador_correo text,
  contexto_sherlyn text,
  slack_message_ts text,
  jefe_aprobacion_solicitada_at timestamptz,
  jefe_aprobacion_recibida_at timestamptz,
  recordatorio_enviado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Tareas de la estimación ----------
create table if not exists tareas_estimacion (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  orden integer not null default 0,
  nombre_original text not null,
  nombre_limpio text,
  descripcion_original text,
  descripcion_limpia text,
  hrs_min integer not null default 0,
  hrs_max integer not null default 0,
  hrs_implementacion integer,
  hrs_pruebas integer,
  hrs_juntas integer,
  created_at timestamptz not null default now()
);

-- ---------- Log de acciones (auditoría) ----------
create table if not exists acciones_cotizacion (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  tipo_accion text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Push subscriptions (Web Push) ----------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  keys jsonb not null,
  user_label text,
  created_at timestamptz not null default now()
);

-- ---------- Settings (config global del panel) ----------
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- Indices útiles ----------
create index if not exists idx_cotizaciones_estado on cotizaciones(estado);
create index if not exists idx_cotizaciones_created on cotizaciones(created_at desc);
create index if not exists idx_tareas_cotizacion on tareas_estimacion(cotizacion_id);
create index if not exists idx_acciones_cotizacion on acciones_cotizacion(cotizacion_id, created_at desc);
create index if not exists idx_proyectos_cliente on proyectos(cliente_id);
create index if not exists idx_contactos_proyecto on contactos_correo(proyecto_id);

-- ---------- Trigger: updated_at ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cotizaciones_updated on cotizaciones;
create trigger trg_cotizaciones_updated before update on cotizaciones
  for each row execute function set_updated_at();

drop trigger if exists trg_proyectos_updated on proyectos;
create trigger trg_proyectos_updated before update on proyectos
  for each row execute function set_updated_at();

drop trigger if exists trg_programadores_updated on programadores;
create trigger trg_programadores_updated before update on programadores
  for each row execute function set_updated_at();
