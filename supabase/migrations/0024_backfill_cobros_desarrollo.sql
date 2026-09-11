-- Backfill: cotizaciones que YA estaban en "en_espera_de_cobro" /
-- "pendiente_por_cobrar" / "cobrada" antes de que existiera Cobros no
-- tienen su Cobro/Período creado por el efecto secundario de
-- cambiar-estado (ese código es nuevo). Este backfill las recorre una vez
-- y les crea su Cobro + primer Período, calculando el monto igual que en
-- la app (monto_fijo si es tipo "fijo", o horas_envio × precio_venta_hora
-- si es por horas).
--
-- Cotizaciones sin proyecto asignado o sin monto calculable se reportan
-- por RAISE NOTICE para revisión manual — no bloquean el resto del backfill.
--
-- Idempotente: si la cotización ya tiene un `cobros` con su id, se salta.

do $$
declare
  cot record;
  v_monto numeric;
  v_moneda text;
  v_estado_periodo text;
  v_cobro_id uuid;
begin
  for cot in
    select c.id, c.nombre, c.estado, c.tipo_precio, c.monto_fijo,
           c.horas_envio, c.precio_venta_hora, c.proyecto_clickup_id
    from cotizaciones c
    where c.estado in ('en_espera_de_cobro', 'pendiente_por_cobrar', 'cobrada')
      and not exists (select 1 from cobros k where k.cotizacion_id = c.id)
  loop
    -- Sin proyecto asignado: no hay a quién facturarle en el catálogo nuevo.
    if cot.proyecto_clickup_id is null then
      raise notice 'Cobros backfill: cotización % ("%") sin proyecto asignado — revisar manualmente', cot.id, cot.nombre;
      continue;
    end if;

    -- proyecto_clickup_id es TEXT (columna original de la integración con
    -- ClickUp, reusada para guardar el id del catálogo de Proyectos como
    -- string) mientras que proyectos.id es UUID — comparamos como texto
    -- para no reventar el backfill si algún valor viejo no es un uuid
    -- válido (ej. un id real de ClickUp de antes del catálogo).
    if not exists (select 1 from proyectos p where p.id::text = cot.proyecto_clickup_id) then
      raise notice 'Cobros backfill: cotización % ("%") apunta a un proyecto inexistente (%) — revisar manualmente', cot.id, cot.nombre, cot.proyecto_clickup_id;
      continue;
    end if;

    -- Monto: mismo cálculo que usa la app.
    if cot.tipo_precio = 'fijo' then
      v_monto := cot.monto_fijo;
    elsif cot.horas_envio is not null and cot.precio_venta_hora is not null and cot.precio_venta_hora > 0 then
      v_monto := cot.horas_envio * cot.precio_venta_hora;
    else
      v_monto := null;
    end if;

    if v_monto is null then
      raise notice 'Cobros backfill: cotización % ("%") sin monto calculable — revisar manualmente', cot.id, cot.nombre;
      continue;
    end if;

    select coalesce(p.moneda_hora, 'MXN') into v_moneda from proyectos p where p.id::text = cot.proyecto_clickup_id;

    v_estado_periodo := case when cot.estado = 'cobrada' then 'facturado' else 'listo_para_cobrar' end;

    insert into cobros (origen, proyecto_id, cotizacion_id, titulo, monto_total, moneda)
    values ('desarrollo', cot.proyecto_clickup_id::uuid, cot.id, cot.nombre, v_monto, v_moneda)
    returning id into v_cobro_id;

    insert into cobros_periodos (cobro_id, estado, etiqueta, monto, moneda)
    values (v_cobro_id, v_estado_periodo, 'Pago único', v_monto, v_moneda);
  end loop;
end $$;
