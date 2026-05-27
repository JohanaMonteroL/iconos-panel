// POST /api/tickets/[id]/reenviar-dm
//
// Reenvía el DM de Slack al asignado actual del ticket con los datos
// vigentes (título, prioridad, horas, descripción). Útil cuando el primer
// DM no llegó, o después de editar el ticket si quieres notificar de nuevo
// a la misma persona.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { postDMByEmail, slackConfigured } from "@/lib/slack/client";
import { blocksTicketAsignado } from "@/lib/slack/blocks";
import { resolverCorreoProgramador } from "@/lib/programadores/resolver-correo";

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
  if (!slackConfigured()) {
    return NextResponse.json({ error: "Slack no configurado" }, { status: 503 });
  }

  const supa = createSupabaseServiceClient();
  const { data: ticket, error } = await supa
    .from("tickets_jira")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  // Si el ticket no tiene correo guardado, intentar resolverlo desde la
  // tabla programadores como fallback.
  let correoFinal: string | null = ticket.asignado_correo;
  if (!correoFinal) {
    correoFinal = await resolverCorreoProgramador(
      ticket.asignado_nombre,
      ticket.asignado_jira_id
    );
    if (correoFinal) {
      // Persistir para próximas veces
      await supa
        .from("tickets_jira")
        .update({ asignado_correo: correoFinal })
        .eq("id", params.id);
    }
  }

  if (!correoFinal) {
    return NextResponse.json(
      {
        error:
          "El asignado no tiene correo registrado, ni en JIRA ni en programadores. Edita el programador en Settings y agrégale un correo.",
      },
      { status: 422 }
    );
  }

  const blocks = blocksTicketAsignado({
    titulo: ticket.titulo,
    jiraKey: ticket.jira_key,
    jiraUrl: ticket.jira_url,
    tipo: ticket.tipo,
    prioridad: (ticket.prioridad ?? "medium").toLowerCase(),
    horasEstimadas: ticket.horas_estimadas,
    proyectoNombre: ticket.proyecto_jira_nombre,
    descripcionMd: ticket.descripcion_md,
    enviadoPor: "Johana Montero",
    actualizacion: true, // banner "Recordatorio / actualización"
  });
  const fallbackText = `🔄 Recordatorio de ticket asignado: ${ticket.titulo} — ${ticket.jira_url}`;

  try {
    const dm = await postDMByEmail({
      email: correoFinal,
      text: fallbackText,
      blocks,
      asUser: true,
    });
    if (!dm) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se encontró usuario de Slack con el correo ${correoFinal}`,
        },
        { status: 404 }
      );
    }

    await supa
      .from("tickets_jira")
      .update({
        slack_dm_ts: dm.ts ?? null,
        slack_dm_canal: dm.channel ?? null,
      })
      .eq("id", params.id);

    revalidatePath(`/panel/tickets/${params.id}`);
    return NextResponse.json({
      ok: true,
      ts: dm.ts,
      channel: dm.channel,
      enviado_a: ticket.asignado_nombre,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error mandando DM" },
      { status: 500 }
    );
  }
}
