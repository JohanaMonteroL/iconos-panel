// POST /api/cotizaciones/extraordinaria
//
// Crea una cotización de monto fijo (sin horas). Caso típico: venta de un
// dispositivo, servicio one-shot, etc. Hace el flujo completo:
//   1. Persiste la cotización en Supabase con tipo_precio='fijo'.
//   2. Manda el mensaje de aprobación al jefe en Slack.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
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

  // 2) Slack al canal admin
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
        clickupUrl: null,
      });

      const r = await postMessage({
        channel: process.env.SLACK_CHANNEL_ADMIN!,
        text: textoSlack,
        blocks: blocksAprobacionCotizacion(textoSlack, cot.id, null),
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
    slack_message_ts,
    slack_warning,
  });
}
