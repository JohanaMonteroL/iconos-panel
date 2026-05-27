-- Conceptos de una cotización extraordinaria (tipo_precio = 'fijo').
-- Cada concepto tiene cantidad y precio unitario; el monto_fijo de la
-- cotización es la suma de cantidad × precio_unitario.

CREATE TABLE IF NOT EXISTS conceptos_cotizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 0,
  concepto TEXT NOT NULL,
  cantidad NUMERIC(12, 2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conceptos_cotizacion_cot_idx
  ON conceptos_cotizacion(cotizacion_id, orden);
