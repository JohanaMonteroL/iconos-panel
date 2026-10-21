-- Restaura `pagos_proveedores_registro`, que se había quitado en la
-- migración 0030 asumiendo que la marca rápida de "pagado" (columna
-- `ultimo_pago_marcado`) bastaba. Johana sí quiere conservar un historial
-- de pagos realizados además del control rápido — ambos coexisten: la marca
-- de "pagado" es para control del período actual, este registro es la
-- bitácora de lo que ya se pagó (opcional, nunca obligatoria).

create table if not exists pagos_proveedores_registro (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references pagos_proveedores(id) on delete cascade,
  fecha date not null,
  monto numeric not null,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_pagos_proveedores_registro_pago on pagos_proveedores_registro(pago_id);
