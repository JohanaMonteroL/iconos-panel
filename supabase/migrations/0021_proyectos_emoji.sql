-- ============================================
-- Emoji de proyecto
--
-- Johana quiere poder elegir un emoji para cada proyecto (desde un picker,
-- no escribiéndolo a mano dentro del nombre como se hacía antes de forma
-- improvisada — ej. "MESQUITA 👕​" ya tenía el emoji pegado al texto). Se
-- guarda aparte para no ensuciar `nombre`; se muestra junto al nombre en
-- toda la app.
-- ============================================

alter table proyectos
  add column if not exists emoji text not null default '';
