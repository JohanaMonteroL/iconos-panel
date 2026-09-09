// POST /api/cotizaciones/[id]/procesar-ia
// Reemplaza a /api/estimaciones/[id]/procesar — misma lógica de IA
// (procesarEstimacion no cambia), pero lee y escribe directo sobre
// `cotizaciones` + `tareas_estimacion` en vez de `estimaciones_formulario`.
//
// Input:  tareas_estimacion.nombre_original/descripcion_original (+ notas
//         y nombre de la cotización, tal como los escribió el programador).
// Output: cotizaciones.nombre/ia_recomendacion/contexto_sherlyn/
//         borrador_correo + tareas_estimacion.nombre_limpio/descripcion_limpia.
//         Las horas (hrs_min/hrs_max) NO se tocan — la IA tiene instrucción
//         de mantenerlas exactamente igual, y son la fuente de verdad real
//         desde que el registro nace (ya no un blob JSON intermedio).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { procesarEstimacion, type EstimacionCruda } from "@/lib/anthropic/process";

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en .env.local. Pégalo desde console.anthropic.com." },
      { status: 503 }
    );
  }

  const supa = createSupabaseServiceClient();
  const { data: cot, error } = await supa
    .from("cotizaciones")
    .select(
      `id, nombre, nombre_original, notas_programador,
       programadores(nombre),
       tareas_estimacion(id, orden, nombre_original, descripcion_original, hrs_min, hrs_max)`
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  const tareas = ((cot as any).tareas_estimacion ?? []).slice().sort(
    (a: any, b: any) => a.orden - b.orden
  );
  if (tareas.length === 0) {
    return NextResponse.json(
      { error: "Agrega al menos una tarea antes de procesar con IA." },
      { status: 422 }
    );
  }

  const raw: EstimacionCruda = {
    nombre_solicitud: (cot as any).nombre_original ?? cot.nombre,
    notas: (cot as any).notas_programador ?? null,
    tareas: tareas.map((t: any) => ({
      nombre: t.nombre_original ?? "",
      descripcion: t.descripcion_original ?? "",
      hrs_min: Number(t.hrs_min) || 0,
      hrs_max: Number(t.hrs_max) || 0,
    })),
  };
  const programadorNombre = (cot as any).programadores?.nombre ?? "—";

  let limpia;
  try {
    limpia = await procesarEstimacion(raw, programadorNombre);
  } catch (e: any) {
    console.error("[procesar-ia] error IA:", e);
    return NextResponse.json(
      { error: e?.message || "Error procesando con IA" },
      { status: 500 }
    );
  }

  const { error: updErr } = await supa
    .from("cotizaciones")
    .update({
      nombre: limpia.nombre_solicitud,
      ia_recomendacion: limpia.recomendacion_horas,
      contexto_sherlyn: limpia.contexto_sherlyn,
      borrador_correo: limpia.borrador_correo,
    })
    .eq("id", params.id);

  if (updErr) {
    console.error("[procesar-ia] update error:", updErr);
    return NextResponse.json(
      { error: `No se pudo guardar: ${updErr.message}` },
      { status: 500 }
    );
  }

  // Actualizar nombre_limpio/descripcion_limpia por tarea (pareadas por
  // posición — la IA no agrega ni quita tareas, solo reescribe texto).
  for (let i = 0; i < tareas.length && i < limpia.tareas.length; i++) {
    const t = tareas[i];
    const tLimpia = limpia.tareas[i];
    await supa
      .from("tareas_estimacion")
      .update({
        nombre_limpio: tLimpia.nombre,
        descripcion_limpia: tLimpia.descripcion,
      })
      .eq("id", t.id);
  }

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  revalidatePath("/panel/cotizaciones");

  return NextResponse.json({ ok: true, datos_limpios: limpia });
}
