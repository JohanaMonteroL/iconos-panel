-- Guardar el nombre del proyecto seleccionado al crear la cotización, para
-- evitar llamadas a ClickUp solo para mostrarlo en el panel.

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS proyecto_nombre TEXT;
