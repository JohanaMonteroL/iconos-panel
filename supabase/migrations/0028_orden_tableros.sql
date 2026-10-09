-- Orden manual de las tarjetas dentro de cada carril de los tableros de
-- Cotizaciones y Cobros (arrastrar una tarjeta más arriba o más abajo).
--
-- `orden` es un número fraccional: menor = más arriba. Al soltar una tarjeta
-- entre otras dos se le asigna el punto medio de sus vecinas, así que mover
-- una tarjeta actualiza solo esa fila (el servidor renumera el carril
-- completo únicamente cuando ya no cabe un punto medio, ver
-- lib/tableros/orden.ts).
--
-- Default = -epoch de creación: las tarjetas nuevas quedan arriba de su
-- carril, igual que el orden "más reciente" que había antes. El backfill usa
-- la misma fórmula sobre created_at para que el orden actual no cambie.

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS orden DOUBLE PRECISION;
UPDATE cotizaciones SET orden = -EXTRACT(EPOCH FROM created_at) WHERE orden IS NULL;
ALTER TABLE cotizaciones ALTER COLUMN orden SET DEFAULT (-EXTRACT(EPOCH FROM NOW()));
ALTER TABLE cotizaciones ALTER COLUMN orden SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado_orden ON cotizaciones (estado, orden);

ALTER TABLE cobros_periodos ADD COLUMN IF NOT EXISTS orden DOUBLE PRECISION;
UPDATE cobros_periodos SET orden = -EXTRACT(EPOCH FROM created_at) WHERE orden IS NULL;
ALTER TABLE cobros_periodos ALTER COLUMN orden SET DEFAULT (-EXTRACT(EPOCH FROM NOW()));
ALTER TABLE cobros_periodos ALTER COLUMN orden SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cobros_periodos_estado_orden ON cobros_periodos (estado, orden);
