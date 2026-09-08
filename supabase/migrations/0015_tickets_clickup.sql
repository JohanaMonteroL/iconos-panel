-- Tickets ClickUp — reemplaza a tickets_jira (JIRA se dio de baja). Tickets de
-- trabajo asignados a programadores, creados en el Space "DESARROLLO" de
-- ClickUp, una Lista por cliente/proyecto. Pueden venir de una cotización
-- aprobada (con cotizacion_ref / tarea_estimacion_ref) o crearse libres desde
-- el panel.
--
-- tickets_jira se deja intacta (histórico, sin uso desde el código).

CREATE TABLE IF NOT EXISTS tickets_clickup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clickup_task_id TEXT NOT NULL UNIQUE,
  clickup_url TEXT NOT NULL,

  titulo TEXT NOT NULL,
  descripcion_md TEXT,
  tipo TEXT NOT NULL,         -- estimacion | desarrollo | soporte | investigacion
  sub_tipo TEXT,              -- task | historia | bug
  prioridad TEXT NOT NULL,    -- highest | high | medium | low | lowest
  horas_estimadas NUMERIC,

  asignado_clickup_id TEXT NOT NULL,
  asignado_nombre TEXT NOT NULL,
  asignado_correo TEXT,

  lista_clickup_id TEXT NOT NULL,
  lista_nombre TEXT NOT NULL,
  carril TEXT,

  cotizacion_ref UUID REFERENCES cotizaciones(id) ON DELETE SET NULL,
  tarea_estimacion_ref UUID REFERENCES tareas_estimacion(id) ON DELETE SET NULL,

  slack_dm_ts TEXT,
  slack_dm_canal TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_clickup_cotizacion_idx ON tickets_clickup(cotizacion_ref);
CREATE INDEX IF NOT EXISTS tickets_clickup_asignado_idx   ON tickets_clickup(asignado_clickup_id);
CREATE INDEX IF NOT EXISTS tickets_clickup_created_idx    ON tickets_clickup(created_at DESC);

-- set_updated_at() ya existe (migración 0007).
DROP TRIGGER IF EXISTS tickets_clickup_updated_at ON tickets_clickup;
CREATE TRIGGER tickets_clickup_updated_at
  BEFORE UPDATE ON tickets_clickup
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
