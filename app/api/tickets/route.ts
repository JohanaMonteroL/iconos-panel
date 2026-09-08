// POST /api/tickets  → crea ticket en ClickUp (Space Desarrollo) + persiste + DM al asignado
// GET  /api/tickets  → listado para el panel (paginado simple)

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  clickUpConfigured,
  createTask,
  resolveProyectoListId,
} from "@/lib/clickup/client";
import {
  aplicarPrefijo,
  mapearPrioridadAClickUp,
  type SubTipoTicket,
  type TipoTicket,
} from "@/lib/tickets/format";
import { postDMByEmail, slackConfigured } from "@/lib/slack/client";
import { blocksTicketAsignadoClickUp } from "@/lib/slack/blocks";
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
  proyecto_nombre: string; // nombre de la Lista de ClickUp (cliente/proyecto)
  asignado_clickup_id: string;
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
  if (!clickUpConfigured() || !process.env.CLICKUP_SPACE_TICKETS_DEV) {
    return NextResponse.json(
      { error: "ClickUp no configurado en este servidor" },
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
  if (!body.proyecto_nombre?.trim()) errores.push("Falta proyecto/cliente");
  if (!body.asignado_clickup_id) errores.push("Falta asignado");
  if (errores.length > 0) {
    return NextResponse.json(
      { error: "Validación falló", detalles: errores },
      { status: 422 }
    );
  }

  // 1) Resolver (o crear) la Lista del cliente/proyecto y crear la tarea en ClickUp
  const tituloFinal = aplicarPrefijo(body.tipo, body.titulo.trim());

  let listId: string;
  try {
    listId = await resolveProyectoListId(body.proyecto_nombre.trim());
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "No se pudo resolver la Lista de ClickUp" },
      { status: 500 }
    );
  }

  let task;
  try {
    task = await createTask({
      list_id: listId,
      name: tituloFinal,
      description: body.descripcion_md ?? undefined,
      status: body.carril ?? undefined,
      priority: mapearPrioridadAClickUp(body.prioridad),
      time_estimate:
        body.horas_estimadas && body.horas_estimadas > 0
          ? Math.round(body.horas_estimadas * 60 * 60 * 1000)
          : undefined,
      assignees: [Number(body.asignado_clickup_id)],
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "No se pudo crear el ticket en ClickUp" },
      { status: 500 }
    );
  }

  // 2) Persistir en Supabase
  const supa = createSupabaseServiceClient();
  const { data: inserted, error: insErr } = await supa
    .from("tickets_clickup")
    .insert({
      clickup_task_id: task.id,
      clickup_url: task.url,
      titulo: tituloFinal,
      descripcion_md: body.descripcion_md ?? null,
      tipo: body.tipo,
      sub_tipo: body.sub_tipo ?? null,
      prioridad: body.prioridad.toLowerCase(),
      horas_estimadas: body.horas_estimadas ?? null,
      asignado_clickup_id: body.asignado_clickup_id,
      asignado_nombre: body.asignado_nombre,
      asignado_correo: body.asignado_correo ?? null,
      lista_clickup_id: listId,
      lista_nombre: body.proyecto_nombre.trim(),
      carril: body.carril ?? null,
      cotizacion_ref: body.cotizacion_ref ?? null,
      tarea_estimacion_ref: body.tarea_estimacion_ref ?? null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    // El ticket ya existe en ClickUp pero no se guardó local — lo reportamos
    // pero no rollback. El usuario puede re-importarlo después si hace falta.
    return NextResponse.json(
      {
        ok: false,
        clickup_task_id: task.id,
        clickup_url: task.url,
        warning: `Ticket creado en ClickUp pero no se persistió: ${
          insErr?.message ?? "desconocido"
        }`,
      },
      { status: 207 }
    );
  }

  // 3) DM a Slack al asignado (best-effort, no bloquea respuesta).
  let correoFinal = body.asignado_correo;
  if (!correoFinal) {
    correoFinal = await resolverCorreoProgramador(
      body.asignado_nombre,
      body.asignado_clickup_id
    );
    if (correoFinal) {
      await supa
        .from("tickets_clickup")
        .update({ asignado_correo: correoFinal })
        .eq("id", inserted.id);
    }
  }

  let slack_warning: string | null = null;
  if (slackConfigured() && correoFinal) {
    try {
      const blocks = blocksTicketAsignadoClickUp({
        titulo: tituloFinal,
        clickupUrl: task.url,
        tipo: body.tipo,
        prioridad: body.prioridad,
        horasEstimadas: body.horas_estimadas ?? null,
        proyectoNombre: body.proyecto_nombre,
        descripcionMd: body.descripcion_md ?? null,
        enviadoPor: "Johana Montero",
      });
      const fallbackText = `📋 Nuevo ticket asignado en ClickUp: ${tituloFinal} — ${task.url}`;
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
          .from("tickets_clickup")
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
      "El asignado no tiene correo (ni en ClickUp ni en programadores) — sin DM de Slack.";
  }

  if (body.cotizacion_ref) {
    revalidatePath(`/panel/cotizaciones/${body.cotizacion_ref}`);
  }
  revalidatePath("/panel");

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    clickup_task_id: task.id,
    clickup_url: task.url,
    slack_warning,
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
    .from("tickets_clickup")
    .select(
      "id, clickup_task_id, clickup_url, titulo, tipo, sub_tipo, prioridad, horas_estimadas, asignado_nombre, asignado_correo, lista_clickup_id, lista_nombre, carril, cotizacion_ref, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (tipo) q = q.eq("tipo", tipo);
  if (proyecto) q = q.eq("lista_clickup_id", proyecto);
  if (asignado) q = q.eq("asignado_clickup_id", asignado);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}
