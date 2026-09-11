-- ============================================
-- Horas efectivamente enviadas por tarea
--
-- Hasta ahora "Horas a enviar" solo guardaba un total agregado en
-- cotizaciones.horas_envio — nunca tocaba las tareas individuales. Johana
-- necesita ver, por tarea, cuántas horas se acomodaron/mandaron realmente
-- al elegir ese total (con o sin buffer), no solo la estimación original
-- (hrs_min/hrs_max, que se conserva intacta).
-- ============================================

alter table tareas_estimacion
  add column if not exists hrs_enviadas numeric(6, 2);
