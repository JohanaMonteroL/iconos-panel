-- ============================================
-- Fusión Cotizaciones + Estimaciones — Fase 1 (aditiva, sin riesgo)
--
-- Amplía `cotizaciones` con las columnas que hoy solo viven en
-- `estimaciones_formulario` / su `datos_raw` jsonb, para que un registro
-- pueda nacer directamente en `cotizaciones` (como placeholder vacío o
-- recién enviado por un programador) y recorrer todo el flujo sin cambiar
-- de tabla ni de id.
--
-- No toca el CHECK de `estado` — eso lo hace la migración 0017, por
-- separado, porque ese sí es el corte real (remapeo de valores + no se
-- puede deshacer fácilmente en producción).
-- ============================================

-- ---------- Campos que hoy solo viven en estimaciones_formulario / datos_raw ----------
alter table cotizaciones
  add column if not exists buffer_porcentaje numeric(5, 2);

alter table cotizaciones
  add column if not exists notas_programador text;

-- Nombre tal cual lo escribió el programador (o Johana, si es un placeholder
-- manual). `nombre` puede terminar reescrito por la IA — `nombre_original`
-- se conserva para mostrar "Original: ..." en el detalle, igual que hacía
-- `datos_raw.nombre_solicitud` antes.
alter table cotizaciones
  add column if not exists nombre_original text;

-- Track de cuándo Johana abrió por primera vez el registro (para el badge
-- del sidebar / PWA). Antes vivía en estimaciones_formulario (migración 0006).
alter table cotizaciones
  add column if not exists revisada_at timestamptz;

-- Tipo de selección de horas_envio (min/pert/max/custom) — antes vivía en
-- datos_raw.envio.tipo. horas_envio (el valor numérico) ya existe desde 0004.
alter table cotizaciones
  add column if not exists horas_envio_tipo text;

-- ---------- Detalle de envío (Fase 2 — subir PDF al marcar "Enviada") ----------
-- Columnas discretas, no JSON, mismo patrón que horas_envio/precio_venta_hora
-- ya existentes (0004/0005).
alter table cotizaciones
  add column if not exists envio_pdf_path text;

alter table cotizaciones
  add column if not exists envio_pdf_nombre_original text;

alter table cotizaciones
  add column if not exists envio_horas_totales numeric(10, 2);

alter table cotizaciones
  add column if not exists envio_costo_aproximado numeric(12, 2);

alter table cotizaciones
  add column if not exists envio_estimado_por text;

alter table cotizaciones
  add column if not exists envio_fecha timestamptz;
