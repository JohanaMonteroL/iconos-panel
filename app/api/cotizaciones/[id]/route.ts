// DELETE /api/cotizaciones/[id]
//   ?borrar_clickup=1  → también borra el ticket de ClickUp asociado
//
// Permite eliminar permanentemente una cotización. La estimación origen
// queda libre (cotizacion_ref vuelve a null) para que pueda reprocesarse
// o archivarse después.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { clickUpConfigured, deleteTask } from "@/lib/clickup/client";

export const runtime = "nodejs";

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

  const borrarClickUp = req.nextUrl.searchParams.get("borrar_clickup") === "1";

  const supa = createSupabaseServiceClient();
  const { data: cot, error: getErr } = await supa
    .from("cotizaciones")
    .select("id, clickup_ticket_id")
    .eq("id", params.id)
    .maybeSingle();

  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }
  if (!cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  // 1) Liberar la estimación si apunta a esta cotización
  await supa
    .from("estimaciones_formulario")
    .update({ cotizacion_ref: null })
    .eq("cotizacion_ref", params.id);

  // 2) Borrar tareas y acciones (FKs)
  await supa.from("tareas_estimacion").delete().eq("cotizacion_id", params.id);
  await supa.from("acciones_cotizacion").delete().eq("cotizacion_id", params.id);

  // 3) Borrar la cotización
  const { error: delErr } = await supa
    .from("cotizaciones")
    .delete()
    .eq("id", params.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // 4) Borrar el ticket de ClickUp (si se pidió)
  let clickup_warning: string | null = null;
  if (borrarClickUp && cot.clickup_ticket_id) {
    if (!clickUpConfigured()) {
      clickup_warning = "ClickUp no configurado — no se pudo borrar el ticket.";
    } else {
      try {
        await deleteTask(cot.clickup_ticket_id);
      } catch (e: any) {
        clickup_warning = e?.message || "No se pudo borrar el ticket de ClickUp";
      }
    }
  }

  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/estimaciones");
  return NextResponse.json({ ok: true, clickup_warning });
}
