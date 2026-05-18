-- ============================================
-- Lifecycle de Estimaciones y Cotizaciones (Fase 1)
--
-- Estimaciones (estimaciones_formulario):
--   recibida        → programador envió, sin tocar
--   procesada_ia    → Johana corrió IA, hay borrador editable guardado
--   descartada      → no se va a convertir en cotización
-- (las "convertidas" desaparecen de /panel/estimaciones porque
--  cotizacion_ref deja de ser null)
--
-- Cotizaciones:
--   esperando_aprobacion → enviada al jefe (ClickUp + Slack)
--   aprobada            → jefe aprobó (o Johana auto-aprobó)
--   cambios_solicitados → jefe pidió cambios
--   en_desarrollo       → pasó a programador
--   enviada_cliente     → Sherlyn ya mandó al cliente
--   archivada           → cerrada
-- ============================================

-- IMPORTANTE: primero quitamos el constraint, luego actualizamos los valores,
-- luego ponemos el constraint nuevo. Si lo hicimos al revés, el UPDATE viola
-- el constraint viejo.

-- 1) Quitar el constraint viejo
alter table estimaciones_formulario
  drop constraint if exists estimaciones_formulario_estado_check;

-- 2) Migrar valores existentes a la nueva nomenclatura
update estimaciones_formulario
   set estado = 'procesada_ia'
 where estado in ('en_revision', 'procesada');

-- 3) Poner el constraint nuevo con la lista actualizada
alter table estimaciones_formulario
  add constraint estimaciones_formulario_estado_check
  check (estado in ('recibida', 'procesada_ia', 'descartada'));

-- 4) Cotizaciones — reasentamos el CHECK por si acaso (mismo orden seguro)
alter table cotizaciones
  drop constraint if exists cotizaciones_estado_check;

alter table cotizaciones
  add constraint cotizaciones_estado_check
  check (estado in (
    'pendiente_revisar',
    'esperando_aprobacion',
    'aprobada',
    'cambios_solicitados',
    'en_desarrollo',
    'enviada_cliente',
    'archivada'
  ));
