// Webhook que recibe los clicks de los botones de Slack (Aprobar / Pedir cambios)
// + el envío del modal de "Pedir cambios".
//
// Slack envía las interacciones a esta URL como form-data con un campo "payload"
// que contiene el JSON.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  verifySlackSignature,
  postDM,
  updateMessage,
  slackConfigured,
} from "@/lib/slack/client";
import {
  blocksMensajeResuelto,
  blocksNotificacionSherlyn,
} from "@/lib/slack/blocks";
import {
  findMatchingStatus,
  resolveCotizacionesListId,
  STATUS_CANDIDATES,
  updateTaskStatus,
} from "@/lib/clickup/client";
import { sendPushToAll } from "@/lib/push/webpush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Slack manda x-www-form-urlencoded con el field "payload"
async function readPayload(req: NextRequest): Promise<{
  rawBody: string;
  payload: any | null;
}> {
  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");
  if (!payloadStr) return { rawBody, payload: null };
  try {
    return { rawBody, payload: JSON.parse(payloadStr) };
  } catch {
    return { rawBody, payload: null };
  }
}

async function handleAprobar(cotizacionId: string, user: any) {
  const supa = createSupabaseServiceClient();
  const aprobadoPor = `${user?.username || user?.name || user?.id || "jefe"} (slack)`;

  // 1) Cambiar estado local
  await supa
    .from("cotizaciones")
    .update({
      estado: "aprobada",
      jefe_aprobacion_recibida_at: new Date().toISOString(),
    })
    .eq("id", cotizacionId);

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: cotizacionId,
    tipo_accion: "estado_aprobada",
    metadata: { aprobado_por: aprobadoPor, via: "slack" },
  });

  // 2) Cambiar carril en ClickUp
  const { data: cot } = await supa
    .from("cotizaciones")
    .select("clickup_ticket_id, nombre, horas_min, horas_max, proyecto_clickup_id, programadores(nombre)")
    .eq("id", cotizacionId)
    .maybeSingle();

  let clickupWarn: string | null = null;
  let clickupUrl: string | null = null;
  if (cot?.clickup_ticket_id && process.env.CLICKUP_API_KEY) {
    try {
      const listId = await resolveCotizacionesListId();
      const { status: matched } = listId
        ? await findMatchingStatus(listId, STATUS_CANDIDATES.aprobada)
        : { status: null };
      if (matched) {
        await updateTaskStatus(cot.clickup_ticket_id, matched);
      }
      clickupUrl = `https://app.clickup.com/t/${cot.clickup_ticket_id}`;
    } catch (e: any) {
      clickupWarn = e?.message || null;
    }
  }

  // 3) DM a Sherlyn
  const sherlynId = process.env.SLACK_USER_SHERLYN_ID;
  if (sherlynId && cot) {
    try {
      const horas =
        cot.horas_max && cot.horas_min
          ? Math.round(((cot.horas_min + cot.horas_max) / 2) * 10) / 10
          : 0;
      await postDM({
        userId: sherlynId,
        text: `Cotización aprobada: ${cot.nombre}`,
        blocks: blocksNotificacionSherlyn(
          cot.nombre,
          null,
          clickupUrl,
          horas
        ),
      });
    } catch (e: any) {
      console.warn("[slack/interactivity] DM a Sherlyn falló:", e);
    }
  }

  // 4) Push a Johana
  sendPushToAll({
    title: "✅ Cotización aprobada",
    body: `${cot?.nombre ?? "Cotización"} fue aprobada por el jefe`,
    url: `/panel/cotizaciones/${cotizacionId}`,
    tag: `cot-${cotizacionId}-aprobada`,
  }).catch(() => {});

  revalidatePath(`/panel/cotizaciones/${cotizacionId}`);
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel");

  return { clickupWarn };
}

async function handlePedirCambios(
  cotizacionId: string,
  user: any,
  comentario: string
) {
  const supa = createSupabaseServiceClient();
  const por = `${user?.username || user?.name || user?.id || "jefe"} (slack)`;

  await supa
    .from("cotizaciones")
    .update({ estado: "cambios_solicitados" })
    .eq("id", cotizacionId);

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: cotizacionId,
    tipo_accion: "estado_cambios_solicitados",
    metadata: { por, comentario, via: "slack" },
  });

  // ClickUp lane
  const { data: cot } = await supa
    .from("cotizaciones")
    .select("clickup_ticket_id, nombre")
    .eq("id", cotizacionId)
    .maybeSingle();

  if (cot?.clickup_ticket_id && process.env.CLICKUP_API_KEY) {
    try {
      const listId = await resolveCotizacionesListId();
      const { status: matched } = listId
        ? await findMatchingStatus(listId, STATUS_CANDIDATES.cambios_solicitados)
        : { status: null };
      if (matched) await updateTaskStatus(cot.clickup_ticket_id, matched);
    } catch (e) {
      console.warn("[slack/interactivity] click-up status falló:", e);
    }
  }

  // Push a Johana con el comentario
  sendPushToAll({
    title: "✏️ Pidieron cambios",
    body: `${cot?.nombre ?? "Cotización"}: ${comentario.slice(0, 120)}`,
    url: `/panel/cotizaciones/${cotizacionId}`,
    tag: `cot-${cotizacionId}-cambios`,
  }).catch(() => {});

  revalidatePath(`/panel/cotizaciones/${cotizacionId}`);
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel");
}

export async function POST(req: NextRequest) {
  if (!slackConfigured()) {
    return NextResponse.json({ ok: true, ignored: "slack not configured" });
  }

  const { rawBody, payload } = await readPayload(req);
  const signature = req.headers.get("x-slack-signature") || "";
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";

  if (!verifySlackSignature({ body: rawBody, timestamp, signature })) {
    return NextResponse.json({ error: "signature inválida" }, { status: 401 });
  }
  if (!payload) {
    return NextResponse.json({ error: "payload faltante" }, { status: 400 });
  }

  // payload.type: "block_actions" o "view_submission"
  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    const actionId = action?.action_id;
    const cotizacionId = action?.value;
    const channel = payload.channel?.id;
    const messageTs = payload.message?.ts;
    const originalText: string =
      payload.message?.blocks?.[0]?.text?.text ?? "";

    if (actionId === "aprobar_cotizacion" && cotizacionId) {
      await handleAprobar(cotizacionId, payload.user);

      if (channel && messageTs) {
        try {
          await updateMessage({
            channel,
            ts: messageTs,
            text: "Cotización aprobada",
            blocks: blocksMensajeResuelto(originalText, "aprobada"),
          });
        } catch {}
      }
      return NextResponse.json({});
    }

    if (actionId === "pedir_cambios_cotizacion" && cotizacionId) {
      // Abrir un modal pidiendo el comentario
      try {
        await fetch("https://slack.com/api/views.open", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trigger_id: payload.trigger_id,
            view: {
              type: "modal",
              callback_id: "pedir_cambios_modal",
              private_metadata: JSON.stringify({
                cotizacionId,
                channel,
                messageTs,
                originalText,
              }),
              title: { type: "plain_text", text: "Pedir cambios" },
              submit: { type: "plain_text", text: "Enviar" },
              close: { type: "plain_text", text: "Cancelar" },
              blocks: [
                {
                  type: "input",
                  block_id: "comentario_block",
                  label: {
                    type: "plain_text",
                    text: "¿Qué cambios necesitas?",
                  },
                  element: {
                    type: "plain_text_input",
                    multiline: true,
                    action_id: "comentario_input",
                  },
                },
              ],
            },
          }),
        });
      } catch (e) {
        console.error("[slack] views.open falló:", e);
      }
      return NextResponse.json({});
    }
  }

  if (payload.type === "view_submission") {
    if (payload.view?.callback_id === "pedir_cambios_modal") {
      const meta = JSON.parse(payload.view.private_metadata || "{}");
      const comentario =
        payload.view?.state?.values?.comentario_block?.comentario_input?.value ?? "";
      await handlePedirCambios(meta.cotizacionId, payload.user, comentario);

      // Reemplazar el mensaje original con un status
      if (meta.channel && meta.messageTs) {
        try {
          await updateMessage({
            channel: meta.channel,
            ts: meta.messageTs,
            text: "Cambios solicitados",
            blocks: blocksMensajeResuelto(
              meta.originalText,
              "cambios_solicitados",
              comentario
            ),
          });
        } catch {}
      }
      return NextResponse.json({ response_action: "clear" });
    }
  }

  return NextResponse.json({});
}
