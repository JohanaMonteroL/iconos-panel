-- ============================================
-- Seed: programadores reales de ICONOS
--
-- Costos derivados de la nómina (mayo 2026):
-- columna "diario" / 8 horas = costo por hora interno.
-- Editar valores aquí si cambian, y volver a correr.
-- ============================================

-- 1) Desactivar cualquier programador previo (incluye los de prueba)
update programadores set activo = false;

-- 2) Upsert por nombre (requiere índice único; lo creamos si no existe)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'programadores_nombre_unique'
  ) then
    create unique index programadores_nombre_unique on programadores (nombre);
  end if;
end$$;

-- 3) Insertar / actualizar los reales
insert into programadores (nombre, precio_hora, activo) values
  ('Adrian Delgado',  196.43, true),
  ('Omar Gonzalez',   133.93, true),
  ('Kevin Arizaga',   162.46, true),
  ('Carlos García',   142.86, true),
  ('Luis Cruz',        66.52, true),
  ('Johana Montero',  142.86, true)
on conflict (nombre) do update set
  precio_hora = excluded.precio_hora,
  activo      = excluded.activo,
  updated_at  = now();

-- 4) Verificación rápida (opcional, comentado)
-- select nombre, precio_hora, activo from programadores order by nombre;
