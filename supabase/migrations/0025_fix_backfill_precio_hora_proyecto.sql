-- Fix: la migración 0024 calculaba el monto de cotizaciones "por horas"
-- usando `cotizaciones.precio_venta_hora` (un snapshot manual y opcional
-- que alimenta únicamente el panel de Análisis financiero/margen, casi
-- nunca capturado). El monto real que se le muestra a Johana como "Precio
-- total que se envió" (EstimacionForm.tsx) se calcula con
-- `horas_envio × proyectos.precio_hora_venta` — la tarifa del proyecto, no
-- ese snapshot. Por eso 0024 saltó de largo cotizaciones reales que sí
-- tenían precio calculable y visible en pantalla (ej. cotizaciones ya
-- "cobrada" que nunca llegaron a tener su Cobro/Período).
--
-- Este backfill repite exactamente la misma lógica de 0024 pero con la
-- fórmula corregida, y solo toca cotizaciones que TODAVÍA no tienen su
-- `cobros` (es idempotente frente a lo que 0024 ya haya creado bien).

do $$
declare
  cot record;
  v_monto numeric;
  v_moneda text;
  v_estado_periodo text;
  v_cobro_id uuid;
  v_precio_hora_venta numeric;
begin
  for cot in
    select c.id, c.nombre, c.estado, c.tipo_precio, c.monto_fijo,
           c.horas_envio, c.proyecto_clickup_id
    from cotizaciones c
    where c.estado in ('en_espera_de_cobro', 'pendiente_por_cobrar', 'cobrada')
      and not exists (select 1 from cobros k where k.cotizacion_id = c.id)
  loop
    if cot.proyecto_clickup_id is null then
      raise notice 'Cobros backfill (fix): cotización % ("%") sin proyecto asignado — revisar manualmente', cot.id, cot.nombre;
      continue;
    end if;

    if not exists (select 1 from proyectos p where p.id::text = cot.proyecto_clickup_id) then
      raise notice 'Cobros backfill (fix): cotización % ("%") apunta a un proyecto inexistente (%) — revisar manualmente', cot.id, cot.nombre, cot.proyecto_clickup_id;
      continue;
    end if;

    select p.precio_hora_venta, coalesce(p.moneda_hora, 'MXN')
      into v_precio_hora_venta, v_moneda
      from proyectos p
      where p.id::text = cot.proyecto_clickup_id;

    if cot.tipo_precio = 'fijo' then
      v_monto := cot.monto_fijo;
    elsif cot.horas_envio is not null and v_precio_hora_venta is not null and v_precio_hora_venta > 0 then
      v_monto := cot.horas_envio * v_precio_hora_venta;
    else
      v_monto := null;
    end if;

    if v_monto is null then
      raise notice 'Cobros backfill (fix): cotización % ("%") sin monto calculable — revisar manualmente', cot.id, cot.nombre;
      continue;
    end if;

    v_estado_periodo := case when cot.estado = 'cobrada' then 'facturado' else 'listo_para_cobrar' end;

    insert into cobros (origen, proyecto_id, cotizacion_id, titulo, monto_total, moneda)
    values ('desarrollo', cot.proyecto_clickup_id::uuid, cot.id, cot.nombre, v_monto, v_moneda)
    returning id into v_cobro_id;

    insert into cobros_periodos (cobro_id, estado, etiqueta, monto, moneda)
    values (v_cobro_id, v_estado_periodo, 'Pago único', v_monto, v_moneda);
  end loop;
end $$;
