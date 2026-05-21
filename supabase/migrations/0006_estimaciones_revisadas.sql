-- Track cuándo Johana abrió por primera vez una estimación, para que el badge
-- del sidebar / PWA se reduzca al visitarla (igual que Slack/WhatsApp).

ALTER TABLE estimaciones_formulario
  ADD COLUMN IF NOT EXISTS revisada_at TIMESTAMPTZ NULL;

-- Marcar como ya revisadas todas las que existen, así el badge arranca limpio.
UPDATE estimaciones_formulario
  SET revisada_at = NOW()
  WHERE revisada_at IS NULL;
