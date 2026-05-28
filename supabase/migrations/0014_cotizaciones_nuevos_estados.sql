-- Añade los estados nuevos al CHECK constraint de cotizaciones:
--   aprobado_cliente  — el cliente aprobó la cotización (Johana lo marca a mano)
--   finalizado        — trabajo entregado y cobrado (estado feliz final)
--
-- Mantenemos los keys existentes — solo cambian las etiquetas en la UI:
--   aprobada → "Aprobado por Iván"

-- Drop el constraint actual y vuelve a crearlo con los estados adicionales.
ALTER TABLE cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

ALTER TABLE cotizaciones
  ADD CONSTRAINT cotizaciones_estado_check
    CHECK (estado IN (
      'pendiente_revisar',
      'esperando_aprobacion',
      'aprobada',
      'cambios_solicitados',
      'aprobado_cliente',
      'enviada_cliente',
      'en_desarrollo',
      'finalizado',
      'archivada'
    ));
