-- Correo del programador para mandar DMs en Slack cuando JIRA tiene el
-- email oculto por privacy. Si está poblado, se usa como fallback al
-- asignar tickets.

ALTER TABLE programadores
  ADD COLUMN IF NOT EXISTS correo TEXT;
