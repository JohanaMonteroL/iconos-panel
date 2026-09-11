-- Catálogo de Proyectos — CRUD simple.
--
-- La tabla `proyectos` ya existía desde 0001_initial_schema.sql (id,
-- cliente_id, nombre, clickup_id, precio_hora_venta, created_at,
-- updated_at) pero nunca se usó desde el código. Aquí la completamos con
-- las columnas que necesita el catálogo nuevo, sin tocar lo que ya había:
-- `cliente_id` y `clickup_id` quedan sin usar (nullable) por ahora, y
-- `precio_hora_venta` se reutiliza tal cual como "costo por hora".
--
-- No se borran proyectos nunca: solo se marcan como inactivos (`activo`).
-- Alta rápida solo pide nombre y contacto principal; el resto se completa
-- después — por eso `contacto_principal` es nullable a nivel de columna y
-- se exige en la API.

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS contacto_principal TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS rfc TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS correo TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS moneda_hora TEXT NOT NULL DEFAULT 'MXN';
ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_moneda_hora_check;
ALTER TABLE proyectos ADD CONSTRAINT proyectos_moneda_hora_check CHECK (moneda_hora IN ('MXN', 'USD'));
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
-- Color de la etiqueta del proyecto (hex) — se usa en todo el sistema donde
-- se muestre el proyecto (listado, y las tarjetas de Cotizaciones nueva
-- vista). Paleta de +20 colores validada en la API (lib/proyectos/colores.ts).
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#6B7280';

CREATE INDEX IF NOT EXISTS proyectos_nombre_idx ON proyectos (lower(nombre));
CREATE INDEX IF NOT EXISTS proyectos_activo_idx ON proyectos (activo);

-- set_updated_at() ya existe (migración 0007).
DROP TRIGGER IF EXISTS proyectos_updated_at ON proyectos;
CREATE TRIGGER proyectos_updated_at
  BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Contactos de facturación — varios correos por proyecto (a quién se le
-- manda la factura/documento de cobro). A diferencia del proyecto, estos sí
-- se pueden borrar libremente: no son un registro de negocio, solo una
-- lista de destinatarios.
CREATE TABLE IF NOT EXISTS proyectos_contactos_facturacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  correo TEXT NOT NULL,
  nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proyectos_contactos_facturacion_proyecto_idx
  ON proyectos_contactos_facturacion (proyecto_id);
