-- Configuración de Soporte por proyecto — activar/desactivar, tipo (fijo
-- por horas mensuales o variable con horas reportadas), y tarifa (si vacía,
-- se usa `precio_hora_venta` del proyecto como fallback).

alter table proyectos add column if not exists soporte_activo boolean not null default false;
alter table proyectos add column if not exists soporte_tipo text check (soporte_tipo in ('fijo', 'variable'));
alter table proyectos add column if not exists soporte_horas_fijas numeric;
alter table proyectos add column if not exists soporte_tarifa_hora numeric; -- si vacío, se usa precio_hora_venta
create index if not exists idx_proyectos_soporte_activo on proyectos(soporte_activo) where soporte_activo = true;
