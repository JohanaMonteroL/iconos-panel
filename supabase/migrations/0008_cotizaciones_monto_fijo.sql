-- Cotizaciones extraordinarias: ventas de hardware, servicios fijos, etc.
-- donde no aplica la métrica de horas × precio. Guardamos un monto total
-- y marcamos el tipo de precio.

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS tipo_precio TEXT DEFAULT 'horas',
  ADD COLUMN IF NOT EXISTS monto_fijo NUMERIC(12, 2);

-- Constraint para limitar valores válidos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cotizaciones_tipo_precio_chk'
  ) THEN
    ALTER TABLE cotizaciones
      ADD CONSTRAINT cotizaciones_tipo_precio_chk
        CHECK (tipo_precio IN ('horas', 'fijo'));
  END IF;
END $$;
