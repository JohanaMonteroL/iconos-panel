// Reenvía el mensaje de aprobación al canal admin en Slack.
// Usa el slack_text guardado (con override de Johana si lo editó).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { postMessage, slackConfigured } from "@/lib/slack/client";
import { blocksAprobacionCotizacion } from "@/lib/slack/blocks";
import { buildSlackText, shortDescripcion, puntosFallback } from "@/lib/slack/format";
import type { EstimacionLimpia } from "@/lib/anthropic/process";

export const runtime = "nodejs";

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
  if (!slackConfigured()) {
    return NextResponse.json(
      {
        error:
          "Slack no configurado. Pon SLACK_BOT_TOKEN y SLACK_CHANNEL_ADMIN en .env.local.",
      },
      { status: 503 }
    );
  }

  const supa = createSupabaseServiceClient();

  // Lee la cotización completa
  const baseSel = `id, nombre, horas_min, horas_max, clickup_ticket_id,
    ia_recomendacion, contexto_sherlyn, borrador_correo, proyecto_clickup_id,
    programadores(nombre),
    tareas_estimacion(orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`;
  const withExtras = `id, nombre, horas_min, horas_max, horas_envio, slack_text,
    clickup_ticket_id, ia_recomendacion, contexto_sherlyn, borrador_correo,
    proyecto_clickup_id,
    programadores(nombre),
    tareas_estimacion(orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`;

  let resp = await supa.from("cotizaciones").select(withExtras).eq("id", params.id).maybeSingle();
  if (resp.error && /(horas_envio|slack_text)/.test(resp.error.message)) {
    resp = await supa.from("cotizaciones").select(baseSel).eq("id", params.id).maybeSingle();
  }
  if (resp.error || !resp.data) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  const cot = resp.data as any;

  // Construir/elegir el texto a enviar
  const tareas = (cot.tareas_estimacion ?? []).slice().sort(
    (a: any, b: any) => a.orden - b.orden
  );
  const programadorNombre = cot.programadores?.nombre ?? "—";
  const horasEnvio =
    cot.horas_envio != null
      ? Number(cot.horas_envio)
      : Math.round(((cot.horas_min + cot.horas_max) / 2) * 10) / 10;
  const clickupUrl = cot.clickup_ticket_id
    ? `https://app.clickup.com/t/${cot.clickup_ticket_id}`
    : null;

  let texto = cot.slack_text as string | null;
  if (!texto) {
    const limpiaSurrogate: EstimacionLimpia = {
      nombre_solicitud: cot.nombre,
      tareas: tareas.map((t: any) => ({
        nombre: t.nombre_limpio ?? "",
        descripcion: t.descripcion_limpia ?? "",
        hrs_min: t.hrs_min,
        hrs_max: t.hrs_max,
      })),
      recomendacion_horas: cot.ia_recomendacion ?? "",
      contexto_sherlyn: cot.contexto_sherlyn ?? "",
      borrador_correo: cot.borrador_correo ?? "",
      descripcion_corta: "",
      puntos_clave: [],
    };
    texto = buildSlackText({
      nombreCotizacion: cot.nombre,
      proyecto: null,
      programador: programadorNombre,
      horasEnvio,
      bufferPct: 0,
      descripcionCorta: shortDescripcion(limpiaSurrogate),
      puntosClave: puntosFallback(limpiaSurrogate),
      notas: null,
      clickupUrl,
    });
  }

  try {
    const r = await postMessage({
      channel: process.env.SLACK_CHANNEL_ADMIN!,
      text: texto,
      blocks: blocksAprobacionCotizacion(texto, cot.id, clickupUrl),
    });

    if (r.ts) {
      await supa
        .from("cotizaciones")
        .update({ slack_message_ts: r.ts })
        .eq("id", params.id);
      await supa.from("acciones_cotizacion").insert({
        cotizacion_id: params.id,
        tipo_accion: "slack_reenviado",
        metadata: { ts: r.ts, channel: r.channel },
      });
    }

    revalidatePath(`/panel/cotizaciones/${params.id}`);
    return NextResponse.json({ ok: true, ts: r.ts, channel: r.channel });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "No se pudo enviar a Slack" },
      { status: 500 }
    );
  }
}
