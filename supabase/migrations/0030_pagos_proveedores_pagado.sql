-- Pagos a proveedores — cambia el "registro de pagos" (historial con fecha/
-- monto/notas por fila) por algo más corto: una sola marca de "pagado" que
-- se resetea sola según la periodicidad del pago (mensual vuelve a quedar
-- pendiente el próximo mes, anual el próximo año, etc.) — sin generar
-- períodos ni tarjetas nuevas como Cobros, solo control rápido de un clic.
--
-- `pagos_proveedores_registro` nunca llegó a usarse en producción (se
-- verificó vacía antes de este cambio), así que se elimina sin migrar datos.

alter table pagos_proveedores add column if not exists ultimo_pago_marcado date;

drop table if exists pagos_proveedores_registro;
