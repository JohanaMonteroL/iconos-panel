-- Cobros — seguimiento de pagos (nueva sección, separada de Cotizaciones).
--
-- Modelo de 2 niveles + pagos: un "Cobro" (el contrato/relación completa)
-- contiene uno o más "Períodos" (cada parcialidad o cada mes — la tarjeta
-- real del tablero, con su propio estado), y cada Período puede tener uno
-- o más "Pagos" (depósitos reales) dentro de su pestaña "Pagos".
--
-- `set_updated_at()` ya existe desde la migración 0007.

create table if not exists cobros (
  id uuid primary key default gen_random_uuid(),
  origen text not null check (origen in ('desarrollo', 'soporte')),
  proyecto_id uuid not null references proyectos(id) on delete restrict,
  cotizacion_id uuid references cotizaciones(id) on delete set null,
  titulo text not null,
  monto_total numeric,        -- total del contrato (desarrollo); null en soporte (abierto/recurrente)
  moneda text not null default 'MXN' check (moneda in ('MXN', 'USD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cobros_proyecto on cobros(proyecto_id);
create index if not exists idx_cobros_cotizacion on cobros(cotizacion_id);
-- Un solo "contrato" de soporte abierto por proyecto — el cron le agrega
-- un período nuevo cada mes, no crea otro cobro.
create unique index if not exists uq_cobros_soporte_por_proyecto
  on cobros(proyecto_id) where origen = 'soporte';
drop trigger if exists cobros_updated_at on cobros;
create trigger cobros_updated_at before update on cobros
  for each row execute function set_updated_at();

create table if not exists cobros_periodos (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references cobros(id) on delete cascade,
  estado text not null default 'listo_para_cobrar'
    check (estado in ('listo_para_cobrar','esperando_aprobacion_pago','por_facturar','facturado')),
  etiqueta text not null,          -- "Agosto 2026" / "Parcialidad 2 de 3" / "Pago único"
  monto numeric not null default 0,
  moneda text not null default 'MXN' check (moneda in ('MXN', 'USD')),
  mes int check (mes between 1 and 12),
  anio int,
  horas_trabajadas numeric,       -- solo soporte
  tarifa_hora_snapshot numeric,   -- tarifa usada al generar (no la tarifa "en vivo" del proyecto)
  orden int not null default 0,
  factura_pdf_path text,
  factura_xml_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cobros_periodos_cobro on cobros_periodos(cobro_id);
create unique index if not exists uq_cobros_periodos_mes
  on cobros_periodos(cobro_id, anio, mes) where mes is not null and anio is not null;
drop trigger if exists cobros_periodos_updated_at on cobros_periodos;
create trigger cobros_periodos_updated_at before update on cobros_periodos
  for each row execute function set_updated_at();

create table if not exists cobros_pagos (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references cobros_periodos(id) on delete cascade,
  monto numeric not null,
  fecha date not null,
  comprobante_path text,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_cobros_pagos_periodo on cobros_pagos(periodo_id);
