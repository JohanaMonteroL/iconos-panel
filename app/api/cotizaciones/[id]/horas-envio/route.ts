// POST /api/cotizaciones/[id]/horas-envio
//
// Cambia el número de horas que verá el jefe en el mensaje de Slack y que
// quedan registradas como "horas_envio" en la cotización. Permite elegir
// entre min / pert / max / personalizado. Después regenera slack_text y
// sincroniza el ticket de ClickUp.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildSlackText } from "@/lib/slack/format";
import { syncCotizacionConClickUp } from "@/lib/clickup/sync";

export const runtime = "nodejs";
export const maxDuration = 30;

const TIPOS = ["min", "pert", "max", "custom"] as const;
type Tipo = (typeof TIPOS)[number];

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

  const tipo = String(body?.tipo ?? "") as Tipo;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();

  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select(
      `id, nombre, horas_min, horas_max, contexto_sherlyn,
       clickup_ticket_id, borrador_correo, ia_recomendacion, proyecto_clickup_id,
       programadores(nombre),
       tareas_estimacion(orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`
    )
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  // Calcular horas_envio según el tipo elegido
  let horasEnvio = 0;
  if (tipo === "min") horasEnvio = Number(cot.horas_min) || 0;
  else if (tipo === "max") horasEnvio = Number(cot.horas_max) || 0;
  else if (tipo === "pert")
    horasEnvio = Math.round(((Number(cot.horas_min) + Number(cot.horas_max)) / 2) * 10) / 10;
  else if (tipo === "custom") {
    const c = Number(body?.custom);
    if (!Number.isFinite(c) || c <= 0) {
      return NextResponse.json(
        { error: "Para tipo 'custom' falta un número válido en `custom`" },
        { status: 422 }
      );
    }
    horasEnvio = Math.round(c * 10) / 10;
  }

  // Regenerar slack_text con las nuevas horas
  const programadorNombre =
    (cot as any).programadores?.nombre ?? "—";
  const tareasOrdenadas = ((cot as any).tareas_estimacion ?? []).sort(
    (a: any, b: any) => a.orden - b.orden
  );
  const puntos = tareasOrdenadas
    .slice(0, 4)
    .map((t: any) => t.nombre_limpio || "")
    .filter(Boolean);
  const descripcionCorta =
    (cot.contexto_sherlyn ?? "").split(/[.\n]/)[0]?.trim() || cot.nombre;
  const clickupUrl = cot.clickup_ticket_id
    ? `https://app.clickup.com/t/${cot.clickup_ticket_id}`
    : null;

  const slackTextNuevo = buildSlackText({
    nombreCotizacion: cot.nombre,
    proyecto: null,
    programador: programadorNombre,
    horasEnvio,
    bufferPct: 0,
    descripcionCorta,
    puntosClave: puntos,
    notas: null,
    clickupUrl,
  });

  // Persistir
  const { error: updErr } = await supa
    .from("cotizaciones")
    .update({
      horas_envio: horasEnvio,
      slack_text: slackTextNuevo,
    })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Sincronizar ClickUp (descripción + custom field "Horas enviadas")
  let clickup_warning: string | null = null;
  if (cot.clickup_ticket_id && process.env.CLICKUP_API_KEY) {
    try {
      const sync = await syncCotizacionConClickUp({
        clickupTicketId: cot.clickup_ticket_id,
        nombre: cot.nombre,
        programadorNombre,
        horasEnvio,
        bufferPct: 0,
        contextoSherlyn: cot.contexto_sherlyn ?? "",
        borradorCorreo: cot.borrador_correo ?? "",
        iaRecomendacion: cot.ia_recomendacion,
        descripcionCorta,
        puntosClave: puntos,
        proyectoClickupId: (cot as any).proyecto_clickup_id ?? null,
        tareas: tareasOrdenadas.map((t: any) => ({
          nombre: t.nombre_limpio ?? "",
          descripcion: t.descripcion_limpia ?? "",
          hrs_min: t.hrs_min ?? 0,
          hrs_max: t.hrs_max ?? 0,
        })),
      });
      if (!sync.ok && sync.warnings.length > 0) {
        clickup_warning = sync.warnings.join(" · ");
      }
    } catch (e: any) {
      clickup_warning = e?.message || "No se pudo sincronizar ClickUp";
    }
  }

  // Log
  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: "horas_envio_cambiada",
    metadata: { tipo, horas_envio: horasEnvio, clickup_warning },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  return NextResponse.json({
    ok: true,
    horas_envio: horasEnvio,
    clickup_warning,
  });
}
