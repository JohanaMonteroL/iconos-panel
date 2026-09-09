-- ============================================
-- Fusión Cotizaciones + Estimaciones — Fase 1 (el corte real)
--
-- Este archivo:
--   1) Quita el CHECK de estado actual.
--   2) Remapea los `estado` existentes de `cotizaciones` al vocabulario
--      nuevo (mismo patrón que 0003/0014: drop constraint → update →
--      re-crear constraint, para que los UPDATE no violen el check viejo).
--   3) Migra las filas de `estimaciones_formulario` que NUNCA se
--      convirtieron en cotización (`cotizacion_ref IS NULL`) hacia
--      `cotizaciones` + `tareas_estimacion`, y actualiza
--      `estimaciones_formulario.cotizacion_ref` con el id nuevo — así queda
--      trazabilidad gratis sin tabla nueva.
--   4) Re-crea el CHECK con los 12 valores nuevos.
--
-- NO se borra `estimaciones_formulario` — se queda como histórico intacto.
--
-- ⚠️ IMPORTANTE — correr en este orden y no a medias:
--   - Antes de aplicar esto a producción, correr por separado:
--       select estado, count(*) from cotizaciones group by 1;
--       select estado, count(*) filter (where cotizacion_ref is null) as sin_convertir
--         from estimaciones_formulario group by 1;
--     y comparar contra los mismos SELECTs después de aplicar la migración
--     (el total de cotizaciones debe crecer exactamente en la cantidad de
--     `sin_convertir`, y esa cantidad debe volverse 0).
--   - Este archivo se aplica junto con el despliegue del backend/frontend
--     nuevo (no puede quedar a medias: en cuanto el código deja de escribir
--     en `estimaciones_formulario`, el vocabulario viejo de estado ya no
--     debe existir en `cotizaciones`).
-- ============================================

-- ---------- 1) Quitar el CHECK actual ----------
alter table cotizaciones
  drop constraint if exists cotizaciones_estado_check;

-- ---------- 2) Remapear valores existentes ----------
-- Orden importa: cada paso solo debe tocar filas que TODAVÍA tienen el
-- valor viejo — por eso 'aprobada' (visto bueno de Iván, ahora solo un
-- timestamp) se remapea ANTES de reusar la palabra 'aprobada' para el
-- visto bueno del cliente.

-- pendiente_revisar → pendiente_revision_interna
update cotizaciones
   set estado = 'pendiente_revision_interna'
 where estado = 'pendiente_revisar';

-- aprobada (Iván) → esperando_aprobacion
-- El aprobado-interno de Iván ya vive en jefe_aprobacion_recibida_at
-- (timestamp, no se toca) — ya no necesita su propio estado.
update cotizaciones
   set estado = 'esperando_aprobacion'
 where estado = 'aprobada';

-- aprobado_cliente → aprobada (nuevo significado: el cliente aprobó)
update cotizaciones
   set estado = 'aprobada'
 where estado = 'aprobado_cliente';

-- enviada_cliente → enviada
update cotizaciones
   set estado = 'enviada'
 where estado = 'enviada_cliente';

-- finalizado → cobrada
update cotizaciones
   set estado = 'cobrada'
 where estado = 'finalizado';

-- cambios_solicitados / en_desarrollo / archivada: sin cambio de valor.

-- ---------- 3) Migrar estimaciones_formulario sin convertir ----------
do $$
declare
  est record;
  tarea jsonb;
  tarea_limpia jsonb;
  idx int;
  v_estado text;
  v_nombre text;
  v_nombre_original text;
  v_horas_min numeric;
  v_horas_max numeric;
  v_horas_envio numeric;
  v_buffer numeric;
  v_new_id uuid;
  v_tareas_raw jsonb;
  v_tareas_limpias jsonb;
begin
  for est in
    select * from estimaciones_formulario where cotizacion_ref is null
  loop
    -- Estado nuevo: las descartadas se archivan, el resto entra a revisión
    -- interna (no sabemos si ya se había abierto/procesado con IA, pero es
    -- el estado más seguro de partida — Johana puede moverla libremente).
    v_estado := case when est.estado = 'descartada' then 'archivada'
                     else 'pendiente_revision_interna' end;

    v_nombre := coalesce(
      est.datos_limpios ->> 'nombre_solicitud',
      est.datos_raw ->> 'nombre_solicitud',
      'Sin nombre'
    );
    v_nombre_original := coalesce(est.datos_raw ->> 'nombre_solicitud', v_nombre);

    v_tareas_raw := coalesce(est.datos_raw -> 'tareas', '[]'::jsonb);
    v_tareas_limpias := est.datos_limpios -> 'tareas';

    select coalesce(sum((t ->> 'hrs_min')::numeric), 0),
           coalesce(sum((t ->> 'hrs_max')::numeric), 0)
      into v_horas_min, v_horas_max
      from jsonb_array_elements(v_tareas_raw) as t;

    v_buffer := coalesce((est.datos_raw ->> 'buffer_porcentaje')::numeric, 0);
    v_horas_envio := nullif(est.datos_raw #>> '{envio,horas}', '')::numeric;

    insert into cotizaciones (
      nombre, nombre_original, programador_id, canal_entrada,
      horas_min, horas_max, horas_envio,
      estado, ia_recomendacion, contexto_sherlyn, borrador_correo,
      buffer_porcentaje, notas_programador,
      proyecto_clickup_id, proyecto_nombre,
      precio_venta_hora, slack_text,
      estimacion_formulario_id,
      created_at
    ) values (
      v_nombre,
      v_nombre_original,
      est.programador_id,
      'formulario',
      coalesce(round(v_horas_min)::int, 0),
      coalesce(round(v_horas_max)::int, 0),
      v_horas_envio,
      v_estado,
      est.datos_limpios ->> 'recomendacion_horas',
      est.datos_limpios ->> 'contexto_sherlyn',
      est.datos_limpios ->> 'borrador_correo',
      v_buffer,
      est.datos_raw ->> 'notas',
      est.datos_raw ->> 'proyecto_clickup_id',
      est.datos_raw ->> 'proyecto_nombre',
      nullif(est.datos_raw ->> 'precio_venta_hora', '')::numeric,
      est.datos_raw ->> 'slack_text_override',
      est.id,
      est.created_at
    )
    returning id into v_new_id;

    idx := 0;
    for tarea in select * from jsonb_array_elements(v_tareas_raw)
    loop
      tarea_limpia := case
        when v_tareas_limpias is not null and jsonb_array_length(v_tareas_limpias) > idx
          then v_tareas_limpias -> idx
        else null
      end;

      insert into tareas_estimacion (
        cotizacion_id, orden, nombre_original, nombre_limpio,
        descripcion_original, descripcion_limpia, hrs_min, hrs_max
      ) values (
        v_new_id,
        idx,
        coalesce(tarea ->> 'nombre', ''),
        tarea_limpia ->> 'nombre',
        tarea ->> 'descripcion',
        tarea_limpia ->> 'descripcion',
        coalesce((tarea ->> 'hrs_min')::int, 0),
        coalesce((tarea ->> 'hrs_max')::int, 0)
      );

      idx := idx + 1;
    end loop;

    update estimaciones_formulario
       set cotizacion_ref = v_new_id
     where id = est.id;
  end loop;
end $$;

-- ---------- 4) Re-crear el CHECK con los 12 valores nuevos ----------
alter table cotizaciones
  add constraint cotizaciones_estado_check
    check (estado in (
      'por_estimar',
      'pendiente_revision_interna',
      'esperando_aprobacion',
      'cambios_solicitados',
      'enviada',
      'aprobada',
      'en_desarrollo',
      'en_espera_de_cobro',
      'pendiente_por_cobrar',
      'rechazada',
      'cobrada',
      'archivada'
    ));
