import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  clickUpConfigured,
  createTask,
  getProyectoFieldId,
  resolveCotizacionesListId,
  getFieldByNamePattern,
  findOptionIdsByName,
  getDefaultAssigneeId,
  findMatchingStatus,
  STATUS_CANDIDATES,
} from "@/lib/clickup/client";
import { buildClickUpDescription, stripEmojis } from "@/lib/clickup/format";
import { buildSlackText, shortDescripcion, puntosFallback } from "@/lib/slack/format";
import { postMessage, slackConfigured } from "@/lib/slack/client";
import { blocksAprobacionCotizacion } from "@/lib/slack/blocks";
import { sendPushToAll } from "@/lib/push/webpush";
import type { EstimacionLimpia, EstimacionCruda } from "@/lib/anthropic/process";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const supa = createSupabaseServiceClient();
  const { data: est, error } = await supa
    .from("estimaciones_formulario")
    .select(
      "id, datos_raw, datos_limpios, programador_id, cotizacion_ref, programadores(nombre, precio_hora)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !est) {
    return NextResponse.json({ error: "Estimación no encontrada" }, { status: 404 });
  }

  if (est.cotizacion_ref) {
    return NextResponse.json(
      { error: "Esta estimación ya fue convertida en cotización", cotizacion_id: est.cotizacion_ref },
      { status: 409 }
    );
  }

  const limpia = est.datos_limpios as EstimacionLimpia | null;
  if (!limpia) {
    return NextResponse.json(
      { error: "Procesa la estimación con IA antes de crear la cotización" },
      { status: 422 }
    );
  }

  const raw = est.datos_raw as EstimacionCruda & {
    proyecto_clickup_id?: string | null;
    proyecto_nombre?: string | null;
    buffer_porcentaje?: number | null;
    precio_venta_hora?: number | null;
    slack_text_override?: string | null;
    envio?: {
      tipo: "min" | "pert" | "max" | "custom";
      custom?: number | null;
      horas?: number;
    } | null;
  };
  const programador = (est as any).programadores;
  const programadorNombre = programador?.nombre ?? "—";

  const bufferPct = Number(raw.buffer_porcentaje ?? 0);
  const factor = 1 + (Number.isFinite(bufferPct) ? bufferPct : 0) / 100;

  // Las horas que van a la cotización son las "con buffer" (lo que se cotiza al cliente)
  const horasMinOrig = limpia.tareas.reduce((s, t) => s + t.hrs_min, 0);
  const horasMaxOrig = limpia.tareas.reduce((s, t) => s + t.hrs_max, 0);
  // horas_min y horas_max son columnas integer en cotizaciones → redondear a entero.
  const horasMin = Math.round(horasMinOrig * factor);
  const horasMax = Math.round(horasMaxOrig * factor);

  // Horas que Johana eligió enviar (la que aparece en el mensaje al jefe).
  // horas_envio es numeric, así que sí permite decimales.
  const horasEnvio =
    raw.envio?.horas != null
      ? Math.round(Number(raw.envio.horas) * 10) / 10
      : Math.round(((horasMin + horasMax) / 2) * 10) / 10;

  // 1) Crear cotización local — sin horas_envio (columna opcional, agregada
  //    por la migración 0004). Lo seteamos en un UPDATE separado para que
  //    funcione aunque la migración no se haya corrido aún.
  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .insert({
      nombre: limpia.nombre_solicitud,
      canal_entrada: "formulario",
      descripcion_original: JSON.stringify(raw),
      descripcion_limpia: limpia.contexto_sherlyn,
      programador_id: est.programador_id,
      proyecto_clickup_id: raw.proyecto_clickup_id ?? null,
      horas_min: horasMin,
      horas_max: horasMax,
      estado: "esperando_aprobacion",
      jefe_aprobacion_solicitada_at: new Date().toISOString(),
      estimacion_formulario_id: est.id,
      ia_recomendacion: limpia.recomendacion_horas,
      borrador_correo: limpia.borrador_correo,
      contexto_sherlyn: limpia.contexto_sherlyn,
    })
    .select("id")
    .single();

  if (cotErr || !cot) {
    console.error("[crear-cotizacion] insert error:", cotErr);
    return NextResponse.json(
      { error: `No se pudo crear la cotización: ${cotErr?.message}` },
      { status: 500 }
    );
  }

  // Best-effort: si la migración 0004 ya corrió, persistir horas_envio
  const { error: horasErr } = await supa
    .from("cotizaciones")
    .update({ horas_envio: horasEnvio })
    .eq("id", cot.id);
  if (horasErr) {
    console.warn(
      "[crear-cotizacion] no se pudo guardar horas_envio (¿falta migración 0004?):",
      horasErr.message
    );
  }

  // Best-effort: si la migración 0010 ya corrió, persistir proyecto_nombre
  // (lo necesitamos para mostrarlo en el listado sin tocar ClickUp).
  if (raw.proyecto_nombre) {
    const { error: proyErr } = await supa
      .from("cotizaciones")
      .update({ proyecto_nombre: raw.proyecto_nombre })
      .eq("id", cot.id);
    if (proyErr) {
      console.warn(
        "[crear-cotizacion] no se pudo guardar proyecto_nombre (¿falta migración 0010?):",
        proyErr.message
      );
    }
  }

  // Construir el mensaje de Slack DEFINITIVO (con override si Johana lo editó).
  // Se guarda en la cotización para que el preview muestre exactamente eso.
  const slackTextGenerado = buildSlackText({
    nombreCotizacion: limpia.nombre_solicitud,
    proyecto: raw.proyecto_nombre ?? null,
    programador: programadorNombre,
    horasEnvio,
    bufferPct,
    descripcionCorta: shortDescripcion(limpia),
    puntosClave: puntosFallback(limpia),
    notas: raw.notas ?? null,
    // clickupUrl se rellena después de crear el ticket (más abajo).
    clickupUrl: null,
  });
  const slackTextFinal = raw.slack_text_override ?? slackTextGenerado;

  // Best-effort: si migración 0005 corrió, guardar precio_venta_hora y slack_text
  const extrasPatch: Record<string, any> = { slack_text: slackTextFinal };
  if (raw.precio_venta_hora != null) {
    extrasPatch.precio_venta_hora = raw.precio_venta_hora;
  }
  const { error: extrasErr } = await supa
    .from("cotizaciones")
    .update(extrasPatch)
    .eq("id", cot.id);
  if (extrasErr) {
    console.warn(
      "[crear-cotizacion] no se pudo guardar slack_text/precio_venta_hora (¿falta migración 0005?):",
      extrasErr.message
    );
  }

  // 2) Insertar tareas
  const tareasRows = limpia.tareas.map((t, i) => ({
    cotizacion_id: cot.id,
    orden: i,
    nombre_original: raw.tareas[i]?.nombre ?? t.nombre,
    nombre_limpio: t.nombre,
    descripcion_original: raw.tareas[i]?.descripcion ?? null,
    descripcion_limpia: t.descripcion,
    hrs_min: t.hrs_min,
    hrs_max: t.hrs_max,
  }));
  if (tareasRows.length > 0) {
    await supa.from("tareas_estimacion").insert(tareasRows);
  }

  // 3) Log
  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: cot.id,
    tipo_accion: "creada_desde_estimacion",
    metadata: {
      estimacion_id: est.id,
      buffer_porcentaje: bufferPct,
      horas_originales: { min: horasMinOrig, max: horasMaxOrig },
      horas_con_buffer: { min: horasMin, max: horasMax },
    },
  });

  // 4) Marcar la estimación como convertida (referencia a la cotización)
  // El estado se queda en procesada_ia; el filtro cotizacion_ref IS NULL la
  // saca del listado de /panel/estimaciones automáticamente.
  await supa
    .from("estimaciones_formulario")
    .update({ cotizacion_ref: cot.id })
    .eq("id", est.id);

  // 5) ClickUp (best-effort)
  let clickup_ticket_id: string | null = null;
  let clickup_url: string | null = null;
  let clickup_warning: string | null = null;

  if (clickUpConfigured()) {
    try {
      // Resolver lista del sprint actual (cambia mes a mes)
      const listId = await resolveCotizacionesListId();
      if (!listId) {
        throw new Error(
          "No se encontró la lista 'Cotizaciones' en el sprint actual del Space ICONOS ADMIN. " +
            "Verifica que exista un sprint folder vigente con una lista 'Cotizaciones'."
        );
      }

      // Descripción con el nuevo formato (H3 + tabla + secciones)
      const description = buildClickUpDescription({
        limpia,
        programadorNombre,
        bufferPct,
        horasEnvio,
        notas: raw.notas ?? null,
      });

      // Custom fields
      const custom_fields: Array<{ id: string; value: any }> = [];

      // 1) Proyecto (drop_down)
      if (raw.proyecto_clickup_id) {
        const proyectoFieldId = await getProyectoFieldId();
        if (proyectoFieldId) {
          custom_fields.push({ id: proyectoFieldId, value: raw.proyecto_clickup_id });
        }
      }

      // 2) Horas enviadas (short_text)
      const horasField = await getFieldByNamePattern(/horas enviad/i);
      if (horasField) {
        custom_fields.push({ id: horasField.id, value: String(horasEnvio) });
      }

      // 3) Programador (labels) — match por nombre
      if (programadorNombre && programadorNombre !== "—") {
        const prog = await findOptionIdsByName(/programador/i, programadorNombre);
        if (prog) {
          custom_fields.push({ id: prog.fieldId, value: prog.optionIds });
        }
      }

      // Assignee: Johana (siempre)
      const johanaId = await getDefaultAssigneeId();

      // Título sin emojis (Johana lo pidió así)
      const titulo = stripEmojis(limpia.nombre_solicitud);

      // Resolver el status "Estimado" en el board real (flex match)
      const { status: estadoEstimado } = await findMatchingStatus(
        listId,
        STATUS_CANDIDATES.estimado
      );

      const task = await createTask({
        list_id: listId,
        name: titulo,
        description,
        status: estadoEstimado ?? undefined,
        assignees: johanaId ? [johanaId] : undefined,
        custom_fields: custom_fields.length > 0 ? custom_fields : undefined,
      });
      clickup_ticket_id = task.id;
      clickup_url = task.url;
      await supa
        .from("cotizaciones")
        .update({ clickup_ticket_id: task.id })
        .eq("id", cot.id);

      // Si NO había override de texto, re-generar el slack_text con la URL real
      if (!raw.slack_text_override) {
        const slackTextConUrl = buildSlackText({
          nombreCotizacion: limpia.nombre_solicitud,
          proyecto: raw.proyecto_nombre ?? null,
          programador: programadorNombre,
          horasEnvio,
          bufferPct,
          descripcionCorta: shortDescripcion(limpia),
          puntosClave: puntosFallback(limpia),
          notas: raw.notas ?? null,
          clickupUrl: task.url,
        });
        await supa
          .from("cotizaciones")
          .update({ slack_text: slackTextConUrl })
          .eq("id", cot.id);
      }

      await supa.from("acciones_cotizacion").insert({
        cotizacion_id: cot.id,
        tipo_accion: "ticket_clickup_creado",
        metadata: { task_id: task.id, url: task.url },
      });
    } catch (e: any) {
      console.error("[clickup] error creando task:", e);
      clickup_warning = e?.message || "No se pudo crear el ticket en ClickUp";
    }
  } else {
    clickup_warning =
      "ClickUp no configurado — la cotización quedó solo en el panel. Configura CLICKUP_API_KEY y CLICKUP_SPACE_ICONOS_ADMIN en .env.local.";
  }

  // 6) Slack al canal admin (best-effort)
  let slack_warning: string | null = null;
  let slack_message_ts: string | null = null;
  if (slackConfigured()) {
    try {
      // Reconstruir el mensaje con la URL final del ticket si la tenemos
      const textoFinal =
        raw.slack_text_override ??
        buildSlackText({
          nombreCotizacion: limpia.nombre_solicitud,
          proyecto: raw.proyecto_nombre ?? null,
          programador: programadorNombre,
          horasEnvio,
          bufferPct,
          descripcionCorta: shortDescripcion(limpia),
          puntosClave: puntosFallback(limpia),
          notas: raw.notas ?? null,
          clickupUrl: clickup_url,
        });

      const r = await postMessage({
        channel: process.env.SLACK_CHANNEL_ADMIN!,
        text: textoFinal, // fallback para notificaciones
        blocks: blocksAprobacionCotizacion(textoFinal, cot.id, clickup_url),
      });

      slack_message_ts = r.ts ?? null;
      if (slack_message_ts) {
        await supa
          .from("cotizaciones")
          .update({ slack_message_ts })
          .eq("id", cot.id);
        await supa.from("acciones_cotizacion").insert({
          cotizacion_id: cot.id,
          tipo_accion: "slack_enviado",
          metadata: { ts: slack_message_ts, channel: r.channel },
        });
      }
    } catch (e: any) {
      console.error("[crear-cotizacion] error slack:", e);
      slack_warning = e?.message || "No se pudo enviar mensaje a Slack";
    }
  } else {
    slack_warning =
      "Slack no configurado (faltan SLACK_BOT_TOKEN o SLACK_CHANNEL_ADMIN).";
  }

  // 7) Push — awaited (fire-and-forget no es confiable en serverless)
  try {
    await sendPushToAll({
      title: "Cotización creada",
      body: `${limpia.nombre_solicitud} (${horasMin}–${horasMax} hrs)`,
      url: `/panel/cotizaciones/${cot.id}`,
      tag: `cotizacion-${cot.id}`,
    });
  } catch (e) {
    console.error("[push] error:", e);
  }

  revalidatePath("/panel/estimaciones");
  revalidatePath(`/panel/estimaciones/${est.id}`);
  revalidatePath("/panel/cotizaciones");
  revalidatePath(`/panel/cotizaciones/${cot.id}`);
  revalidatePath("/panel");

  return NextResponse.json({
    ok: true,
    cotizacion_id: cot.id,
    clickup_ticket_id,
    clickup_url,
    clickup_warning,
    slack_message_ts,
    slack_warning,
  });
}
