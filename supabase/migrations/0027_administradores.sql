-- Múltiples usuarios administradores con acceso completo al panel (/panel).
-- Mismo patrón que `programadores` (0013): Johana genera una contraseña
-- temporal y el administrador la cambia en su primer login. El login
-- original de Johana (solo contraseña, tabla `settings`) sigue funcionando
-- tal cual — esta tabla es aditiva, no lo reemplaza.

CREATE TABLE IF NOT EXISTS administradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  password_hash TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  ultimo_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS administradores_correo_unico
  ON administradores (lower(correo));

-- set_updated_at() ya existe (migración 0007).
DROP TRIGGER IF EXISTS administradores_updated_at ON administradores;
CREATE TRIGGER administradores_updated_at
  BEFORE UPDATE ON administradores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
