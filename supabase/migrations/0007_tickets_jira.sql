-- Tickets JIRA — tickets de trabajo asignados a programadores. Pueden venir
-- de una cotización aprobada (con cotizacion_ref / tarea_estimacion_ref) o
-- crearse libres desde el panel.

CREATE TABLE IF NOT EXISTS tickets_jira (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_key TEXT NOT NULL UNIQUE,
  jira_url TEXT NOT NULL,

  titulo TEXT NOT NULL,
  descripcion_md TEXT,
  tipo TEXT NOT NULL,         -- estimacion | desarrollo | soporte | investigacion
  sub_tipo TEXT,              -- task | historia | bug
  prioridad TEXT NOT NULL,    -- highest | high | medium | low | lowest
  horas_estimadas NUMERIC,

  asignado_jira_id TEXT NOT NULL,
  asignado_nombre TEXT NOT NULL,
  asignado_correo TEXT,

  proyecto_jira_key TEXT NOT NULL,
  proyecto_jira_nombre TEXT NOT NULL,
  carril TEXT,

  cotizacion_ref UUID REFERENCES cotizaciones(id) ON DELETE SET NULL,
  tarea_estimacion_ref UUID REFERENCES tareas_estimacion(id) ON DELETE SET NULL,

  slack_dm_ts TEXT,
  slack_dm_canal TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_jira_cotizacion_idx ON tickets_jira(cotizacion_ref);
CREATE INDEX IF NOT EXISTS tickets_jira_asignado_idx   ON tickets_jira(asignado_jira_id);
CREATE INDEX IF NOT EXISTS tickets_jira_created_idx    ON tickets_jira(created_at DESC);

-- Mantener updated_at sincronizado en cada UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_jira_updated_at ON tickets_jira;
CREATE TRIGGER tickets_jira_updated_at
  BEFORE UPDATE ON tickets_jira
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
