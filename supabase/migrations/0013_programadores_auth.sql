-- Auth para programadores: pueden entrar al panel con su correo + contraseña
-- y ver únicamente sus propias estimaciones. Johana setea contraseña
-- temporal y el programador la cambia en el primer login.

ALTER TABLE programadores
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimo_login_at TIMESTAMPTZ;

-- Asegura que dos programadores no compartan correo (necesario para login).
CREATE UNIQUE INDEX IF NOT EXISTS programadores_correo_unico
  ON programadores (lower(correo))
  WHERE correo IS NOT NULL;
