// POST /api/tickets  → crea ticket en JIRA + persiste + DM al asignado
// GET  /api/tickets  → listado para el panel (paginado simple)

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  createIssue,
  getActiveSprint,
  jiraConfigured,
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
const SUB_TIPOS: SubTipoTicket[] = ["task", "historia", "bug"];
const PRIORIDADES = ["highest", "high", "medium", "low", "lowest"];

type CrearTicketBody = {
  titulo: string;
  descripcion_md?: string | null;
  tipo: TipoTicket;
  sub_tipo?: SubTipoTicket | null;
  prioridad: string;
  horas_estimadas?: number | null;
  proyecto_jira_key: string;
  proyecto_jira_nombre: string;
  asignado_jira_id: string;
  asignado_nombre: string;
  asignado_correo?: string | null;
  carril?: string | null;
  cotizacion_ref?: string | null;
  tarea_estimacion_ref?: string | null;
};

// ── POST ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  if (!jiraConfigured()) {
    return NextResponse.json(
      { error: "JIRA no configurado en este servidor" },
      { status: 503 }
    );
  }

  let body: CrearTicketBody;
  try {
    body = (await req.json()) as CrearTicketBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Validación
  const errores: string[] = [];
  if (!body.titulo?.trim()) errores.push("Falta título");
  if (!TIPOS.includes(body.tipo)) errores.push("Tipo inválido");
  if (body.sub_tipo && !SUB_TIPOS.includes(body.sub_tipo))
    errores.push("Sub-tipo inválido");
  if (!PRIORIDADES.includes(body.prioridad?.toLowerCase()))
    errores.push("Prioridad inválida");
  if (!body.proyecto_jira_key) errores.push("Falta proyecto");
  if (!body.asignado_jira_id) errores.push("Falta asignado");
  if (errores.length > 0) {
    return NextResponse.json(
      { error: "Validación falló", detalles: errores },
      { status: 422 }
    );
  }

  // 1) Crear en JIRA
  const tituloFinal = aplicarPrefijo(body.tipo, body.titulo.trim());
  const issueTypeName = mapearIssueTypeName(body.tipo, body.sub_tipo ?? null);
  const prioridadName = mapearPrioridadAJira(body.prioridad);
  const descripcionAdf = markdownToAdf(body.descripcion_md ?? "");

  // Sprint activo del proyecto (best-effort).
  let sprintId: number | null = null;
  try {
    const s = await getActiveSprint(body.proyecto_jira_key);
    sprintId = s?.id ?? null;
  } catch {}

  let jira;
  try {
    jira = await createIssue({
      proyectoKey: body.proyecto_jira_key,
      titulo: tituloFinal,
      descripcionAdf,
      issueTypeName,
      asignadoAccountId: body.asignado_jira_id,
      prioridadName,
      horasEstimadas: body.horas_estimadas ?? null,
      sprintId,
      carrilName: body.carril ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "No se pudo crear el ticket en JIRA" },
      { status: 500 }
    );
  }

  // 2) Persistir en Supabase
  const supa = createSupabaseServiceClient();
  const { data: inserted, error: insErr } = await supa
    .from("tickets_jira")
    .insert({
      jira_key: jira.key,
      jira_url: jira.url,
      titulo: tituloFinal,
      descripcion_md: body.descripcion_md ?? null,
      tipo: body.tipo,
      sub_tipo: body.sub_tipo ?? null,
      prioridad: body.prioridad.toLowerCase(),
      horas_estimadas: body.horas_estimadas ?? null,
      asignado_jira_id: body.asignado_jira_id,
      asignado_nombre: body.asignado_nombre,
      asignado_correo: body.asignado_correo ?? null,
      proyecto_jira_key: body.proyecto_jira_key,
      proyecto_jira_nombre: body.proyecto_jira_nombre,
      carril: body.carril ?? null,
      cotizacion_ref: body.cotizacion_ref ?? null,
      tarea_estimacion_ref: body.tarea_estimacion_ref ?? null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    // El ticket ya existe en JIRA pero no se guardó local — lo reportamos
    // pero no rollback. El usuario puede re-importarlo después si hace falta.
    return NextResponse.json(
      {
        ok: false,
        jira_key: jira.key,
        jira_url: jira.url,
        warning: `Ticket creado en JIRA pero no se persistió: ${
          insErr?.message ?? "desconocido"
        }`,
      },
      { status: 207 }
    );
  }

  // 3) DM a Slack al asignado (best-effort, no bloquea respuesta).
  // Si SLACK_USER_TOKEN está configurado, el DM sale "como Johana"; si no,
  // sale del bot.
  //
  // Resolución de correo: primero el que vino de JIRA. Si JIRA lo oculta
  // por privacy, caemos a la tabla `programadores` (correo manual).
  let correoFinal = body.asignado_correo;
  if (!correoFinal) {
    correoFinal = await resolverCorreoProgramador(
      body.asignado_nombre,
      body.asignado_jira_id
    );
    if (correoFinal) {
      // Persistir el correo encontrado en el ticket para próximos DMs.
      await supa
        .from("tickets_jira")
        .update({ asignado_correo: correoFinal })
        .eq("id", inserted.id);
    }
  }

  let slack_warning: string | null = null;
  if (slackConfigured() && correoFinal) {
    try {
      const blocks = blocksTicketAsignado({
        titulo: tituloFinal,
        jiraKey: jira.key,
        jiraUrl: jira.url,
        tipo: body.tipo,
        prioridad: body.prioridad,
        horasEstimadas: body.horas_estimadas ?? null,
        proyectoNombre: body.proyecto_jira_nombre,
        descripcionMd: body.descripcion_md ?? null,
        enviadoPor: "Johana Montero",
      });
      const fallbackText = `📋 Nuevo ticket asignado en JIRA: ${tituloFinal} — ${jira.url}`;
      const dm = await postDMByEmail({
        email: correoFinal!,
        text: fallbackText,
        blocks,
        asUser: true,
      });
      if (!dm) {
        slack_warning = `No se encontró usuario de Slack con el correo ${correoFinal}`;
      } else {
        await supa
          .from("tickets_jira")
          .update({
            slack_dm_ts: dm.ts ?? null,
            slack_dm_canal: dm.channel ?? null,
          })
          .eq("id", inserted.id);
      }
    } catch (e: any) {
      slack_warning = e?.message ?? "Error mandando DM a Slack";
    }
  } else if (!correoFinal) {
    slack_warning =
      "El asignado no tiene correo (ni en JIRA ni en programadores) — sin DM de Slack.";
  }

  revalidatePath("/panel/tickets");
  return NextResponse.json({
    ok: true,
    id: inserted.id,
    jira_key: jira.key,
    jira_url: jira.url,
    slack_warning,
    sprint_warning: jira.sprintWarning ?? null,
  });
}

// ── GET — listado ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [] });
  }

  const url = req.nextUrl;
  const tipo = url.searchParams.get("tipo");
  const proyecto = url.searchParams.get("proyecto");
  const asignado = url.searchParams.get("asignado");

  const supa = createSupabaseServiceClient();
  let q = supa
    .from("tickets_jira")
    .select(
      "id, jira_key, jira_url, titulo, tipo, sub_tipo, prioridad, horas_estimadas, asignado_nombre, asignado_correo, proyecto_jira_key, proyecto_jira_nombre, carril, cotizacion_ref, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (tipo) q = q.eq("tipo", tipo);
  if (proyecto) q = q.eq("proyecto_jira_key", proyecto);
  if (asignado) q = q.eq("asignado_jira_id", asignado);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}
