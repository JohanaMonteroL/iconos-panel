// POST /api/estimaciones — formulario público de programadores.
//
// Desde la fusión Cotizaciones + Estimaciones, este endpoint inserta DIRECTO
// en `cotizaciones` (+ `tareas_estimacion`) con estado "pendiente_revision_interna"
// — ya no pasa por `estimaciones_formulario`, que se queda como histórico
// (sin escrituras nuevas). El formulario (EstimacionForm.tsx) y la página
// "nueva" no cambiaron: siguen mandando el mismo payload.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validateEstimacion } from "@/lib/validation";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push/webpush";
import { ESTADOS_ESTIMACION_ACTIVA } from "@/lib/estados";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const result = validateEstimacion(body);
  if (!result.ok || !result.data) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Servidor sin configurar (falta SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 503 }
    );
  }

  const supa = createSupabaseServiceClient();

  // Confirmar que el programador existe y está activo.
  const { data: prog, error: progErr } = await supa
    .from("programadores")
    .select("id, nombre, activo")
    .eq("id", result.data.programador_id)
    .maybeSingle();

  if (progErr || !prog || !prog.activo) {
    return NextResponse.json(
      { errors: [{ path: "programador_id", message: "Estimador no válido." }] },
      { status: 422 }
    );
  }

  const totalMin = result.data.tareas.reduce((s, t) => s + t.hrs_min, 0);
  const totalMax = result.data.tareas.reduce((s, t) => s + t.hrs_max, 0);

  const { data: inserted, error: insErr } = await supa
    .from("cotizaciones")
    .insert({
      nombre: result.data.nombre_solicitud,
      nombre_original: result.data.nombre_solicitud,
      programador_id: prog.id,
      canal_entrada: "formulario",
      notas_programador: result.data.notas ?? null,
      proyecto_clickup_id: result.data.proyecto_clickup_id ?? null,
      proyecto_nombre: result.data.proyecto_nombre ?? null,
      buffer_porcentaje: result.data.buffer_porcentaje ?? 0,
      horas_min: Math.round(totalMin),
      horas_max: Math.round(totalMax),
      estado: "pendiente_revision_interna",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "No se pudo guardar la estimación." }, { status: 500 });
  }

  const tareasRows = result.data.tareas.map((t, i) => ({
    cotizacion_id: inserted.id,
    orden: i,
    nombre_original: t.nombre,
    descripcion_original: t.descripcion,
    hrs_min: t.hrs_min,
    hrs_max: t.hrs_max,
  }));
  if (tareasRows.length > 0) {
    await supa.from("tareas_estimacion").insert(tareasRows);
  }

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: inserted.id,
    tipo_accion: "creada_desde_formulario",
    metadata: { programador: prog.nombre },
  });

  // Push a Johana — awaited para que la función serverless no se termine antes
  // de mandar el push (era la causa por la que no llegaban las notificaciones
  // de "nueva estimación" pero sí las de cotización, que viene de un flow más largo).

  // Contar pendientes para el badge del PWA — mismo criterio que el sidebar
  // y el dashboard (por_estimar / pendiente_revision_interna, sin revisar).
  let badgeCount = 0;
  try {
    const r = await supa
      .from("cotizaciones")
      .select("id", { count: "exact", head: true })
      .is("revisada_at", null)
      .in("estado", ESTADOS_ESTIMACION_ACTIVA);
    badgeCount = r.count ?? 0;
  } catch {}

  try {
    await sendPushToAll({
      title: "Nueva estimación recibida",
      body: `${prog.nombre} envió "${result.data.nombre_solicitud}" (${totalMin}–${totalMax} hrs)`,
      url: `/panel/cotizaciones/${inserted.id}`,
      tag: `estimacion-${inserted.id}`,
      badgeCount,
    });
  } catch (e) {
    console.error("[push] error:", e);
  }

  // Invalidar caches para que la nueva estimación aparezca de inmediato en:
  //   - /panel (badge del sidebar + contadores del dashboard)
  //   - /panel/estimaciones (vista filtrada de cotizaciones tempranas)
  //   - /panel/cotizaciones (listado general)
  revalidatePath("/panel");
  revalidatePath("/panel/estimaciones");
  revalidatePath("/panel/cotizaciones");

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 });
}
