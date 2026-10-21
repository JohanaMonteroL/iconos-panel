-- Pagos a proveedores — catálogo de pagos salientes a proveedores externos
-- (SUA, etc.).
--
-- No es un tablero de flujo: es la ficha de referencia que hoy Johana lleva
-- en Excel, para no tener que buscarla cada vez que ejecuta un pago — abrir
-- el pago y copiar cuenta/referencia/titular/correo. No está ligado a
-- clientes ni proyectos (son proveedores externos). El registro de pagos ya
-- ejecutados es opcional, nunca obligatorio para guardar un pago.
--
-- Nombradas `pagos_proveedores(_registro)` y no `pagos` a secas: la base ya
-- tiene una tabla `pagos` legada (ligada a cotizaciones/plan_pagos, con
-- columnas tipo `gorilla_folio`) que no vive en ninguna migración de este
-- repo y que ningún código actual usa — probablemente de una integración de
-- facturación anterior. Se deja intacta; estas tablas son nuevas y separadas.
--
-- `set_updated_at()` ya existe desde la migración 0007.

create table if not exists pagos_proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre_pago text not null,              -- "SUA"
  empresa_contacto text,                  -- empresa o contacto
  periodicidad text not null default 'mensual'
    check (periodicidad in ('unica_vez','mensual','bimestral','trimestral','semestral','anual')),
  monto numeric not null default 0,
  iva numeric not null default 0,
  total_a_pagar numeric not null default 0,
  forma_pago text not null default 'manual' check (forma_pago in ('automatica','manual')),
  tipo_pago text check (tipo_pago in ('transferencia','tarjeta','deposito','otro')),
  banco_o_cuenta text,                    -- CLABE / número de cuenta / tarjeta
  titular text,                           -- nombre de la cuenta / titular
  correo_comprobante text,                -- correo al que se manda el comprobante
  comprobante_tipo text not null default 'no_aplica'
    check (comprobante_tipo in ('factura','recibo','no_aplica')),
  referencia text,
  notas text,
  activo boolean not null default true,   -- "archivar" sin borrar, como programadores.activo
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pagos_proveedores_activo on pagos_proveedores(activo);
drop trigger if exists pagos_proveedores_updated_at on pagos_proveedores;
create trigger pagos_proveedores_updated_at before update on pagos_proveedores
  for each row execute function set_updated_at();

-- Registro opcional de pagos ya ejecutados contra un pago a proveedor —
-- llenarlo no es obligatorio, es solo para quien quiera llevar un historial.
create table if not exists pagos_proveedores_registro (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references pagos_proveedores(id) on delete cascade,
  fecha date not null,
  monto numeric not null,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_pagos_proveedores_registro_pago on pagos_proveedores_registro(pago_id);
