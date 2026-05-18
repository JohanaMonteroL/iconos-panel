-- ============================================
-- Campos extras para cotizaciones (Fase 1 final)
--
-- precio_venta_hora: snapshot del precio al cliente al crear cotización.
--                    Permite mostrar ganancia y editarlo independiente
--                    de la estimación origen.
-- slack_text       : congelado del mensaje a Slack al "Enviar a aprobación".
--                    Lo que se mandó / mandará. Sobrevive a cambios
--                    posteriores en la estimación.
-- ============================================

alter table cotizaciones
  add column if not exists precio_venta_hora numeric(10, 2);

alter table cotizaciones
  add column if not exists slack_text text;
