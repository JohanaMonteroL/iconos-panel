-- ============================================
-- Agrega la columna horas_envio a cotizaciones.
--
-- horas_envio = total que Johana elige enviar al jefe / al cliente
-- (puede ser min, PERT, max o un valor personalizado).
-- ============================================

alter table cotizaciones
  add column if not exists horas_envio numeric(10, 2);
