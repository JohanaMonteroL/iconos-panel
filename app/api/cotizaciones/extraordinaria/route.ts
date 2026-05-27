// POST /api/cotizaciones/extraordinaria
//
// Crea una cotización de monto fijo (sin horas). Caso típico: venta de un
// dispositivo, servicio one-shot, etc. Hace el flujo completo:
//   1. Persiste la cotización en Supabase con tipo_precio='fijo'.
//   2. Crea el ticket de ClickUp con descripción adaptada al monto fijo.
//   3. Manda el mensaje de aprobación al jefe en Slack.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  clickUpConfigured,
  createTask,
  resolveCotizacionesListId,
  getProyectoFieldId,
  getFieldByNamePattern,
  findOptionIdsByName,
  getDefaultAssigneeId,
  findMatchingStatus,
  STATUS_CANDIDATES,
} from "@/lib/clickup/client";
import { buildClickUpDescriptionFijo, stripEmojis } from "@/lib/clickup/format";
import { buildSlackTextFijo } from "@/lib/slack/format";
import { postMessage, slackConfigured } from "@/lib/slack/client";
import { blocksAprobacionCotizacion } from "@/lib/slack/blocks";
import { sendPushToAll } from "@/lib/push/webpush";

export const runtime = "nodejs";
export const maxDuration = 30;

type ConceptoBody = {
  concepto: string;
  cantidad: number;
  precio_unitario: number;
};

type Body = {
  nombre: string;
  // Si se manda `conceptos`, el monto se calcula a partir de ellos.
  // Si no, se usa `monto` directo (modo viejo de un solo importe).
  monto?: number; // MXN
  conceptos?: ConceptoBody[];
  programador_id?: string | null;
  descripcion_corta?: string;
  borrador_correo?: string | null;
  notas?: string | null;
  proyecto_clickup_id?: string | null;
  proyecto_nombre?: string | null;
};

export async function POST(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Validación
  const errores: string[] = [];
  if (!body.nombre?.trim()) errores.push("Falta nombre");

  // Normalizamos conceptos y calculamos monto si vienen.
  const conceptosNorm: ConceptoBody[] = (body.conceptos ?? [])
    .map((c) => ({
      concepto: String(c?.concepto ?? "").trim(),
      cantidad: Number(c?.cantidad ?? 0),
      precio_unitario: Number(c?.precio_unitario ?? 0),
    }))
    .filter((c) => c.concepto.length > 0);

  conceptosNorm.forEach((c, i) => {
    if (!Number.isFinite(c.cantidad) || c.cantidad <= 0)
      errores.push(`Concepto ${i + 1}: cantidad inválida`);
    if (!Number.isFinite(c.precio_unitario) || c.precio_unitario < 0)
      errores.push(`Concepto ${i + 1}: precio unitario inválido`);
  });

  const montoCalculado = conceptosNorm.reduce(
    (s, c) => s + c.cantidad * c.precio_unitario,
    0
  );
  const montoTotal =
    conceptosNorm.length > 0
      ? montoCalculado
      : Number.isFinite(body.monto)
      ? Number(body.monto)
      : 0;

  if (montoTotal <= 0) errores.push("Monto total inválido (debe ser > 0)");

  if (errores.length > 0) {
    return NextResponse.json(
      { error: "Validación falló", detalles: errores },
      { status: 422 }
    );
  }

  const descripcionCorta = (body.descripcion_corta ?? "").trim();

  const supa = createSupabaseServiceClient();

  // Programador opcional (solo para tracking interno).
  let programadorNombre: string | null = null;
  if (body.programador_id) {
    const { data: prog } = await supa
      .from("programadores")
      .select("nombre")
      .eq("id", body.programador_id)
      .maybeSingle();
    programadorNombre = prog?.nombre ?? null;
  }

  // 1) Persistir la cotización (con fallback si la migración 0010 aún no se
  //    aplicó — proyecto_nombre se queda fuera).
  const insertBase = {
    nombre: body.nombre.trim(),
    programador_id: body.programador_id ?? null,
    tipo_precio: "fijo",
    monto_fijo: montoTotal,
    horas_min: 0,
    horas_max: 0,
    horas_envio: 0,
    descripcion_original: descripcionCorta,
    descripcion_limpia: descripcionCorta,
    contexto_sherlyn: descripcionCorta,
    borrador_correo: body.borrador_correo?.trim() || null,
    proyecto_clickup_id: body.proyecto_clickup_id ?? null,
    estado: "esperando_aprobacion",
    jefe_aprobacion_solicitada_at: new Date().toISOString(),
  };
  const insertConProyecto = {
    ...insertBase,
    proyecto_nombre: body.proyecto_nombre ?? null,
  };

  let cotResp = await supa
    .from("cotizaciones")
    .insert(insertConProyecto)
    .select("id")
    .single();

  if (cotResp.error && /proyecto_nombre/i.test(cotResp.error.message)) {
    cotResp = await supa
      .from("cotizaciones")
      .insert(insertBase)
      .select("id")
      .single();
  }

  const cot = cotResp.data;
  const cotErr = cotResp.error;
  if (cotErr || !cot) {
    return NextResponse.json(
      { error: cotErr?.message ?? "No se pudo crear la cotización" },
      { status: 500 }
    );
  }

  // Insertar conceptos si vinieron
  if (conceptosNorm.length > 0) {
    const rows = conceptosNorm.map((c, i) => ({
      cotizacion_id: cot.id,
      orden: i,
      concepto: c.concepto,
      cantidad: c.cantidad,
      precio_unitario: c.precio_unitario,
    }));
    const { error: cErr } = await supa
      .from("conceptos_cotizacion")
      .insert(rows);
    if (cErr) {
      console.error("[extraordinaria] no se pudieron guardar conceptos:", cErr);
    }
  }

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: cot.id,
    tipo_accion: "creada_extraordinaria",
    metadata: {
      monto: montoTotal,
      conceptos: conceptosNorm.length,
      programador: programadorNombre,
    },
  });

  // 2) ClickUp (best-effort)
  let clickup_ticket_id: string | null = null;
  let clickup_url: string | null = null;
  let clickup_warning: string | null = null;

  if (clickUpConfigured()) {
    try {
      const listId = await resolveCotizacionesListId();
      if (!listId) {
        throw new Error(
          "No se encontró la lista 'Cotizaciones' en el sprint actual."
        );
      }

      const description = buildClickUpDescriptionFijo({
        nombre: body.nombre.trim(),
        montoFijoMxn: montoTotal,
        programadorNombre,
        descripcion: descripcionCorta,
        conceptos: conceptosNorm,
        borradorCorreo: body.borrador_correo,
        notas: body.notas,
      });

      // Custom fields que apliquen.
      const custom_fields: Array<{ id: string; value: any }> = [];

      if (body.proyecto_clickup_id) {
        const proyectoFieldId = await getProyectoFieldId();
        if (proyectoFieldId) {
          custom_fields.push({ id: proyectoFieldId, value: body.proyecto_clickup_id });
        }
      }

      // Asignar programador si existe (al campo Programador del board).
      if (programadorNombre && programadorNombre !== "—") {
        const prog = await findOptionIdsByName(/programador/i, programadorNombre);
        if (prog) {
          custom_fields.push({ id: prog.fieldId, value: prog.optionIds });
        }
      }

      // Campo opcional "Monto" si existe en el board.
      const montoField = await getFieldByNamePattern(/monto|total|precio/i);
      if (montoField) {
        custom_fields.push({ id: montoField.id, value: montoTotal });
      }

      const johanaId = await getDefaultAssigneeId();
      const titulo = stripEmojis(body.nombre.trim());
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

      await supa.from("acciones_cotizacion").insert({
        cotizacion_id: cot.id,
        tipo_accion: "ticket_clickup_creado",
        metadata: { task_id: task.id, url: task.url },
      });
    } catch (e: any) {
      console.error("[clickup extraordinaria] error:", e);
      clickup_warning = e?.message || "No se pudo crear el ticket en ClickUp";
    }
  } else {
    clickup_warning = "ClickUp no configurado — la cotización quedó solo en el panel.";
  }

  // 3) Slack al canal admin
  let slack_warning: string | null = null;
  let slack_message_ts: string | null = null;
  if (slackConfigured()) {
    try {
      const textoSlack = buildSlackTextFijo({
        nombreCotizacion: body.nombre.trim(),
        proyecto: body.proyecto_nombre ?? null,
        programador: programadorNombre,
        montoFijoMxn: montoTotal,
        descripcionCorta: descripcionCorta,
        conceptos: conceptosNorm,
        notas: body.notas ?? null,
        clickupUrl: clickup_url,
      });

      const r = await postMessage({
        channel: process.env.SLACK_CHANNEL_ADMIN!,
        text: textoSlack,
        blocks: blocksAprobacionCotizacion(textoSlack, cot.id, clickup_url),
      });

      slack_message_ts = r.ts ?? null;

      await supa
        .from("cotizaciones")
        .update({
          slack_text: textoSlack,
          slack_message_ts: r.ts ?? null,
        })
        .eq("id", cot.id);
    } catch (e: any) {
      slack_warning = e?.message || "No se pudo enviar a Slack";
    }
  } else {
    slack_warning =
      "Slack no configurado — el jefe no recibió la notificación.";
  }

  // 4) Push
  try {
    await sendPushToAll({
      title: "Cotización rápida creada",
      body: `${body.nombre.trim()} — $${montoTotal.toLocaleString("es-MX")} MXN`,
      url: `/panel/cotizaciones/${cot.id}`,
      tag: `cotizacion-${cot.id}`,
    });
  } catch {}

  revalidatePath("/panel/cotizaciones");
  return NextResponse.json({
    ok: true,
    id: cot.id,
    clickup_ticket_id,
    clickup_url,
    slack_message_ts,
    clickup_warning,
    slack_warning,
  });
}
