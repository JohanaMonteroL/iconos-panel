// GET    /api/tickets/[id] → detalle del ticket
// PATCH  /api/tickets/[id] → edita y sincroniza con JIRA
// DELETE /api/tickets/[id] → borra (en JIRA + panel)

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  deleteIssue,
  jiraConfigured,
  transitionIssueToStatus,
  updateIssue,
} from "@/lib/jira/client";
import {
  aplicarPrefijo,
  mapearIssueTypeName,
  mapearPrioridadAJira,
  markdownToAdf,
  type SubTipoTicket,
  type TipoTicket,
} from "@/lib/jira/format";
import { postDMByEmail, slackConfigured } from "@/lib/slack/client";
import { blocksTicketAsignado } from "@/lib/slack/blocks";
import { resolverCorreoProgramador } from "@/lib/programadores/resolver-correo";

export const runtime = "nodejs";
export const maxDuration = 30;

const TIPOS: TipoTicket[] = ["estimacion", "desarrollo", "soporte", "investigacion"];
const SUBTIPOS: SubTipoTicket[] = ["task", "historia", "bug"];
const PRIORIDADES = ["highest", "high", "medium", "low", "lowest"];

// ── GET ────────────────────────────────────────────────────────────────

export async function GET(
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
  const { data, error } = await supa
    .from("tickets_jira")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ticket: data });
}

// ── PATCH ──────────────────────────────────────────────────────────────

type PatchBody = {
  titulo?: string;
  descripcion_md?: string | null;
  tipo?: TipoTicket;
  sub_tipo?: SubTipoTicket | null;
  prioridad?: string;
  horas_estimadas?: number | null;
  asignado_jira_id?: string;
  asignado_nombre?: string;
  asignado_correo?: string | null;
  carril?: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  if (!jiraConfigured()) {
    return NextResponse.json({ error: "JIRA no configurado" }, { status: 503 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Validaciones blandas (solo si vienen los campos).
  if (body.tipo && !TIPOS.includes(body.tipo))
    return NextResponse.json({ error: "Tipo inválido" }, { status: 422 });
  if (body.sub_tipo && !SUBTIPOS.includes(body.sub_tipo))
    return NextResponse.json({ error: "Sub-tipo inválido" }, { status: 422 });
  if (body.prioridad && !PRIORIDADES.includes(body.prioridad.toLowerCase()))
    return NextResponse.json({ error: "Prioridad inválida" }, { status: 422 });

  const supa = createSupabaseServiceClient();
  const { data: actual, error: getErr } = await supa
    .from("tickets_jira")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !actual) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  // Calcular qué mandar a JIRA
  const nuevoTipo = (body.tipo ?? actual.tipo) as TipoTicket;
  const nuevoSubTipo = (body.sub_tipo ?? actual.sub_tipo) as SubTipoTicket | null;
  const cambioTitulo = body.titulo !== undefined;
  const cambioDesc = body.descripcion_md !== undefined;
  const cambioTipo = body.tipo !== undefined || body.sub_tipo !== undefined;
  const cambioPrioridad = body.prioridad !== undefined;
  const cambioAsignado = body.asignado_jira_id !== undefined;
  const cambioHoras = body.horas_estimadas !== undefined;
  const cambioCarril =
    body.carril !== undefined && body.carril !== actual.carril;

  const tituloFinal = cambioTitulo
    ? aplicarPrefijo(nuevoTipo, (body.titulo ?? "").trim())
    : cambioTipo
    ? aplicarPrefijo(nuevoTipo, actual.titulo.replace(
        /^\s*(Estimación|Soporte|Investigación)\s*:\s*/i,
        ""
      ))
    : null;

  const descMdFinal = cambioDesc ? body.descripcion_md ?? "" : null;

  // 1) Actualizar en JIRA (best-effort por campo, recolectamos warnings)
  const warnings: string[] = [];
  try {
    await updateIssue(actual.jira_key, {
      titulo: tituloFinal ?? undefined,
      descripcionAdf: descMdFinal != null ? markdownToAdf(descMdFinal) : undefined,
      prioridadName: cambioPrioridad
        ? mapearPrioridadAJira(body.prioridad!)
        : undefined,
      asignadoAccountId: cambioAsignado ? body.asignado_jira_id : undefined,
      horasEstimadas: cambioHoras ? body.horas_estimadas ?? null : undefined,
      issueTypeName: cambioTipo
        ? mapearIssueTypeName(nuevoTipo, nuevoSubTipo)
        : undefined,
    });
  } catch (e: any) {
    warnings.push(`JIRA update: ${e?.message?.slice(0, 200) ?? "error"}`);
  }

  // Carril → transition aparte (puede fallar si no hay ruta válida)
  if (cambioCarril && body.carril) {
    try {
      await transitionIssueToStatus(actual.jira_key, body.carril);
    } catch (e: any) {
      warnings.push(`JIRA carril: ${e?.message?.slice(0, 200) ?? "error"}`);
    }
  }

  // 2) Persistir en Supabase
  const patch: Record<string, unknown> = {};
  if (cambioTitulo || cambioTipo) patch.titulo = tituloFinal ?? actual.titulo;
  if (cambioDesc) patch.descripcion_md = descMdFinal;
  if (body.tipo !== undefined) patch.tipo = body.tipo;
  if (body.sub_tipo !== undefined) patch.sub_tipo = body.sub_tipo;
  if (cambioPrioridad) patch.prioridad = body.prioridad!.toLowerCase();
  if (cambioHoras) patch.horas_estimadas = body.horas_estimadas;
  if (cambioAsignado) {
    patch.asignado_jira_id = body.asignado_jira_id;
    if (body.asignado_nombre) patch.asignado_nombre = body.asignado_nombre;
    if (body.asignado_correo !== undefined)
      patch.asignado_correo = body.asignado_correo;
  }
  if (body.carril !== undefined) patch.carril = body.carril;

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await supa
      .from("tickets_jira")
      .update(patch)
      .eq("id", params.id);
    if (updErr) {
      warnings.push(`Supabase: ${updErr.message}`);
    }
  }

  // 3) DM al NUEVO asignado si cambió (best-effort). Sale como Johana si
  // SLACK_USER_TOKEN está configurado, si no del bot.
  // Resolución de correo con fallback a tabla programadores.
  let correoParaDM = body.asignado_correo ?? null;
  if (
    cambioAsignado &&
    body.asignado_jira_id &&
    body.asignado_jira_id !== actual.asignado_jira_id &&
    !correoParaDM
  ) {
    correoParaDM = await resolverCorreoProgramador(
      body.asignado_nombre,
      body.asignado_jira_id
    );
    if (correoParaDM) {
      patch.asignado_correo = correoParaDM;
      await supa
        .from("tickets_jira")
        .update({ asignado_correo: correoParaDM })
        .eq("id", params.id);
    }
  }

  if (
    cambioAsignado &&
    body.asignado_jira_id &&
    body.asignado_jira_id !== actual.asignado_jira_id &&
    correoParaDM &&
    slackConfigured()
  ) {
    try {
      const tituloMostrar = tituloFinal ?? actual.titulo;
      const blocks = blocksTicketAsignado({
        titulo: tituloMostrar,
        jiraKey: actual.jira_key,
        jiraUrl: actual.jira_url,
        tipo: nuevoTipo,
        prioridad: (body.prioridad ?? actual.prioridad).toLowerCase(),
        horasEstimadas:
          body.horas_estimadas !== undefined
            ? body.horas_estimadas
            : actual.horas_estimadas,
        proyectoNombre: actual.proyecto_jira_nombre,
        descripcionMd:
          body.descripcion_md !== undefined
            ? body.descripcion_md
            : actual.descripcion_md,
        enviadoPor: "Johana Montero",
        actualizacion: true,
      });
      const fallbackText = `🔄 Ticket reasignado a ti: ${tituloMostrar} — ${actual.jira_url}`;
      const dm = await postDMByEmail({
        email: correoParaDM!,
        text: fallbackText,
        blocks,
        asUser: true,
      });
      if (!dm) {
        warnings.push(
          `No se encontró usuario de Slack con el correo ${correoParaDM}`
        );
      } else {
        await supa
          .from("tickets_jira")
          .update({
            slack_dm_ts: dm.ts ?? null,
            slack_dm_canal: dm.channel ?? null,
          })
          .eq("id", params.id);
      }
    } catch (e: any) {
      warnings.push(`Slack DM: ${e?.message?.slice(0, 200) ?? "error"}`);
    }
  }

  revalidatePath("/panel/tickets");
  revalidatePath(`/panel/tickets/${params.id}`);

  return NextResponse.json({
    ok: warnings.length === 0,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}

// ── DELETE ─────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const borrarJira = req.nextUrl.searchParams.get("borrar_jira") === "1";

  const supa = createSupabaseServiceClient();
  const { data: ticket, error: getErr } = await supa
    .from("tickets_jira")
    .select("id, jira_key")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!ticket)
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  let jira_warning: string | null = null;
  if (borrarJira && ticket.jira_key && jiraConfigured()) {
    try {
      await deleteIssue(ticket.jira_key);
    } catch (e: any) {
      jira_warning = e?.message ?? "No se pudo borrar el ticket de JIRA";
    }
  } else if (borrarJira && !jiraConfigured()) {
    jira_warning = "JIRA no configurado — solo se borró el registro local.";
  }

  const { error: delErr } = await supa
    .from("tickets_jira")
    .delete()
    .eq("id", params.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  revalidatePath("/panel/tickets");
  return NextResponse.json({ ok: true, jira_warning });
}
