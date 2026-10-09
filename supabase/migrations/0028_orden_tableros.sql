-- Orden manual de las tarjetas dentro de cada carril de los tableros de
-- Cotizaciones y Cobros (arrastrar una tarjeta más arriba o más abajo).
--
-- `orden_tablero` es un número fraccional: menor = más arriba. Al soltar una
-- tarjeta entre otras dos se le asigna el punto medio de sus vecinas, así
-- que mover una tarjeta actualiza solo esa fila (el servidor renumera el
-- carril completo únicamente cuando ya no cabe un punto medio, ver
-- lib/tableros/orden.ts).
--
-- Default = -epoch de creación: las tarjetas nuevas quedan arriba de su
-- carril, igual que el orden "más reciente" que había antes. El backfill usa
-- la misma fórmula sobre created_at para que el orden actual no cambie.
--
-- ⚠️ Es seguro correrla más de una vez, y corrige la primera versión de esta
-- migración, que usaba una columna `orden`:
--   - en `cotizaciones` creaba `orden` → aquí se renombra a `orden_tablero`;
--   - en `cobros_periodos` YA EXISTÍA `orden` (0022) con otro significado:
--     la secuencia del período dentro de su cobro (Parcialidad 1, 2, 3…),
--     que usa el detalle para ordenar las pestañas. La versión anterior le
--     cambió el default y el tablero la sobrescribió al arrastrar. Aquí se
--     restaura el default y se recalcula la secuencia.

-- ---------- cotizaciones ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cotizaciones' AND column_name = 'orden'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cotizaciones' AND column_name = 'orden_tablero'
  ) THEN
    ALTER TABLE cotizaciones RENAME COLUMN orden TO orden_tablero;
  END IF;
END $$;
DROP INDEX IF EXISTS idx_cotizaciones_estado_orden;

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS orden_tablero DOUBLE PRECISION;
UPDATE cotizaciones SET orden_tablero = -EXTRACT(EPOCH FROM created_at) WHERE orden_tablero IS NULL;
ALTER TABLE cotizaciones ALTER COLUMN orden_tablero SET DEFAULT (-EXTRACT(EPOCH FROM NOW()));
ALTER TABLE cotizaciones ALTER COLUMN orden_tablero SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado_orden_tablero ON cotizaciones (estado, orden_tablero);

-- ---------- cobros_periodos: reparar `orden` (secuencia dentro del cobro) ----------
ALTER TABLE cobros_periodos ALTER COLUMN orden SET DEFAULT 0;
DROP INDEX IF EXISTS idx_cobros_periodos_estado_orden;

-- Secuencia original: orden de creación; las parcialidades se insertan en
-- un solo INSERT (mismo created_at), así que se desempatan por el número de
-- "Parcialidad N de M". Produce el mismo orden de pestañas que había antes.
WITH secuencia AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY cobro_id
      ORDER BY
        created_at,
        (SUBSTRING(etiqueta FROM '^Parcialidad ([0-9]+) de'))::int NULLS LAST,
        id
    ) - 1)::int AS n
  FROM cobros_periodos
)
UPDATE cobros_periodos p
SET orden = s.n
FROM secuencia s
WHERE p.id = s.id AND p.orden IS DISTINCT FROM s.n;

-- ---------- cobros_periodos: orden del tablero ----------
ALTER TABLE cobros_periodos ADD COLUMN IF NOT EXISTS orden_tablero DOUBLE PRECISION;
UPDATE cobros_periodos SET orden_tablero = -EXTRACT(EPOCH FROM created_at) WHERE orden_tablero IS NULL;
ALTER TABLE cobros_periodos ALTER COLUMN orden_tablero SET DEFAULT (-EXTRACT(EPOCH FROM NOW()));
ALTER TABLE cobros_periodos ALTER COLUMN orden_tablero SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cobros_periodos_estado_orden_tablero ON cobros_periodos (estado, orden_tablero);
