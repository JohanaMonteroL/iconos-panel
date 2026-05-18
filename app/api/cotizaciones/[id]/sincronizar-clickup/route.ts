// Reenvía el estado actual de la cotización al ticket de ClickUp:
// nombre, descripción completa (markdown), horas enviadas, proyecto, programador.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { syncCotizacionConClickUp } from "@/lib/clickup/sync";
import { shortDescripcion, puntosFallback } from "@/lib/slack/format";
import type { EstimacionLimpia } from "@/lib/anthropic/process";

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

  const supa = createSupabaseServiceClient();
  const { data: cot, error } = await supa
    .from("cotizaciones")
    .select(
      `id, nombre, horas_min, horas_max, horas_envio, clickup_ticket_id,
       proyecto_clickup_id, ia_recomendacion, contexto_sherlyn, borrador_correo,
       programadores(nombre),
       tareas_estimacion(orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  if (!cot.clickup_ticket_id) {
    return NextResponse.json(
      { error: "Esta cotización aún no tiene ticket en ClickUp" },
      { status: 422 }
    );
  }

  const tareas = ((cot as any).tareas_estimacion as any[]) ?? [];
  tareas.sort((a, b) => a.orden - b.orden);

  const programadorNombre = (cot as any).programadores?.nombre ?? "—";
  const horasEnvio =
    (cot as any).horas_envio != null
      ? Number((cot as any).horas_envio)
      : Math.round(((cot.horas_min + cot.horas_max) / 2) * 10) / 10;

  // Fallbacks para los campos de Slack (los usamos también para clickup)
  const limpiaSurrogate: EstimacionLimpia = {
    nombre_solicitud: cot.nombre,
    tareas: tareas.map((t) => ({
      nombre: t.nombre_limpio,
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

  const result = await syncCotizacionConClickUp({
    clickupTicketId: cot.clickup_ticket_id,
    nombre: cot.nombre,
    programadorNombre,
    horasEnvio,
    bufferPct: 0,
    contextoSherlyn: cot.contexto_sherlyn ?? "",
    borradorCorreo: cot.borrador_correo ?? "",
    iaRecomendacion: cot.ia_recomendacion,
    descripcionCorta: shortDescripcion(limpiaSurrogate),
    puntosClave: puntosFallback(limpiaSurrogate),
    proyectoClickupId: cot.proyecto_clickup_id,
    tareas: limpiaSurrogate.tareas,
  });

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: "sync_clickup_manual",
    metadata: {
      task_updated: result.taskUpdated,
      custom_fields_updated: result.customFieldsUpdated,
      warnings: result.warnings,
    },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  return NextResponse.json(result);
}
