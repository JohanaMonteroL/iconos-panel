-- Cobros creados a mano (sin cotización ni Soporte de por medio) — Johana
-- puede dar de alta un Cobro directo desde /panel/cobros, capturando quién
-- lo estimó/atendió y una descripción libre, cosa que no aplicaba cuando
-- el único origen era una cotización o el cron de Soporte.
--
-- `horas` es puramente informativo (el monto ya quedó fijo en
-- cobros.monto_total al crearse) — para poder mostrar "40h capturadas"
-- después, igual que el resto de la ficha.

alter table cobros add column if not exists programador_id uuid references programadores(id) on delete set null;
alter table cobros add column if not exists descripcion text;
alter table cobros add column if not exists horas numeric;

create index if not exists idx_cobros_programador on cobros(programador_id);
