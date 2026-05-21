// Cambia el estado de la cotización (aprobada, cambios_solicitados, archivada, etc.).
// Si pasa a "aprobada", actualiza también el carril en ClickUp.
// Registra en el log con acciones_cotizacion.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  updateTaskStatus,
  findMatchingStatus,
  resolveCotizacionesListId,
  deleteTask,
  STATUS_CANDIDATES,
} from "@/lib/clickup/client";

export const runtime = "nodejs";

const ESTADOS_VALIDOS = [
  "esperando_aprobacion",
  "aprobada",
  "cambios_solicitados",
  "en_desarrollo",
  "enviada_cliente",
  "archivada",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nuevo = String(body?.estado ?? "");
  if (!ESTADOS_VALIDOS.includes(nuevo)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 422 });
  }
  const comentario = body?.comentario ? String(body.comentario) : null;
  const aprobadoPor = body?.aprobado_por ? String(body.aprobado_por) : null; // "johana" | "ivan"
  const borrarClickUp = Boolean(body?.borrar_clickup_ticket);

  const supa = createSupabaseServiceClient();

  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select("id, estado, clickup_ticket_id")
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  const patch: Record<string, any> = { estado: nuevo };
  if (nuevo === "aprobada") {
    patch.jefe_aprobacion_recibida_at = new Date().toISOString();
  }

  const { error: updErr } = await supa
    .from("cotizaciones")
    .update(patch)
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // ClickUp — actualizar el lane si tenemos ticket (matching flexible).
  // Caso especial: si se archiva y se pidió borrar el ticket, lo eliminamos.
  let clickup_warning: string | null = null;

  if (
    nuevo === "archivada" &&
    borrarClickUp &&
    cot.clickup_ticket_id &&
    process.env.CLICKUP_API_KEY
  ) {
    try {
      await deleteTask(cot.clickup_ticket_id);
      await supa
        .from("cotizaciones")
        .update({ clickup_ticket_id: null })
        .eq("id", params.id);
    } catch (e: any) {
      clickup_warning = e?.message || "No se pudo borrar el ticket de ClickUp";
    }
  }

  const candidates = STATUS_CANDIDATES[nuevo];
  if (
    !borrarClickUp &&
    cot.clickup_ticket_id &&
    candidates &&
    candidates.length > 0 &&
    process.env.CLICKUP_API_KEY
  ) {
    try {
      const listId = await resolveCotizacionesListId();
      const { status: matched, available } = listId
        ? await findMatchingStatus(listId, candidates)
        : { status: null, available: [] };

      if (matched) {
        await updateTaskStatus(cot.clickup_ticket_id, matched);
      } else if (available.length > 0) {
        clickup_warning =
          `Ningún carril de ClickUp coincide con "${nuevo}". ` +
          `Carriles disponibles: ${available.join(" · ")}. ` +
          `Agrega uno de: ${candidates.join(" / ")} en el board, ` +
          `o avísame para mapear a otro nombre.`;
      }
    } catch (e: any) {
      clickup_warning =
        e?.message || `No se pudo actualizar el carril en ClickUp.`;
    }
  }

  // Log
  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: `estado_${nuevo}`,
    metadata: {
      estado_anterior: cot.estado,
      estado_nuevo: nuevo,
      aprobado_por: aprobadoPor,
      comentario,
      clickup_warning,
    },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel");

  return NextResponse.json({ ok: true, clickup_warning });
}
