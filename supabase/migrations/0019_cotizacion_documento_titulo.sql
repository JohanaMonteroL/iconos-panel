-- ============================================
-- Nombre de documento personalizado para el PDF de envío
--
-- Hasta ahora el "detalle del envío" solo guardaba el nombre de archivo
-- original (envio_pdf_nombre_original, ej. "cotizacion_final_v3.pdf").
-- Johana quiere poder ponerle un nombre legible al documento al subirlo
-- (ej. "Cotización — Sistema de Nómina"), independiente del nombre del
-- archivo. Mismo patrón que las demás columnas envio_* (0016): campo
-- discreto, no JSON.
-- ============================================

alter table cotizaciones
  add column if not exists envio_pdf_titulo text;
