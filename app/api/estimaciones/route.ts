// POST /api/estimaciones — formulario público de programadores, y también
// el formulario de creación admin (Johana, /panel/cotizaciones/nueva-estimacion).
//
// Desde la fusión Cotizaciones + Estimaciones, este endpoint inserta DIRECTO
// en `cotizaciones` (+ `tareas_estimacion`) con estado "pendiente_revision_interna"
// — ya no pasa por `estimaciones_formulario`, que se queda como histórico
// (sin escrituras nuevas).
//
// Campos admin-only (no forman parte del payload compartido en lib/validation.ts
// porque el programador nunca los manda — se leen directo del body crudo):
//   - guardar_borrador: true  → estado "por_estimar" en vez de "pendiente_revision_interna",
//     y permite 0 tareas (validateEstimacion exige al menos una).
//   - notificar: false        → no manda el push a Johana (para cuando ELLA misma
//     es quien está creando el registro).
//   - horas_envio_tipo/horas_envio_custom → guarda `horas_envio` desde la creación,
//     mismo cálculo que /api/cotizaciones/[id]/horas-envio (min/pert/max/custom).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validateEstimacion } from "@/lib/validation";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push/webpush";
import { ESTADOS_ESTIMACION_ACTIVA } from "@/lib/estados";

export const runtime = "nodejs";

type TareaLigera = { nombre: string; descripcion: string; hrs_min: number; hrs_max: number };

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const raw = (body as Record<string, unknown> | null) ?? {};
  const guardarBorrador = raw["guardar_borrador"] === true;

  // Validación: la compartida (exige ≥1 tarea) para el flujo normal, o una
  // versión relajada (0 tareas permitidas) cuando se guarda como borrador.
  let programador_id: string;
  let nombre_solicitud: string;
  let notas: string | undefined;
  let proyecto_clickup_id: string | undefined;
  let proyecto_nombre: string | undefined;
  let buffer_porcentaje: number;
  let tareas: TareaLigera[];

  if (guardarBorrador) {
    programador_id = String(raw.programador_id ?? "").trim();
    nombre_solicitud = String(raw.nombre_solicitud ?? "").trim();
    notas = raw.notas ? String(raw.notas) : undefined;
    proyecto_clickup_id = raw.proyecto_clickup_id
      ? String(raw.proyecto_clickup_id).trim() || undefined
      : undefined;
    proyecto_nombre = raw.proyecto_nombre ? String(raw.proyecto_nombre).trim() || undefined : undefined;
    const bufferRaw = raw.buffer_porcentaje;
    buffer_porcentaje =
      bufferRaw == null || bufferRaw === ""
        ? 0
        : Number.isFinite(Number(bufferRaw)) && Number(bufferRaw) >= 0 && Number(bufferRaw) <= 100
        ? Number(bufferRaw)
        : 0;

    const errors: { path: string; message: string }[] = [];
    if (!programador_id) errors.push({ path: "programador_id", message: "Selecciona un estimador." });
    if (!nombre_solicitud) errors.push({ path: "nombre_solicitud", message: "Pon un nombre." });

    const tareasRaw = Array.isArray(raw.tareas) ? (raw.tareas as any[]) : [];
    tareas = [];
    tareasRaw.forEach((t, i) => {
      const nom = String(t?.nombre ?? "").trim();
      if (!nom) return; // borrador: filas vacías simplemente se ignoran
      const hrs_min = Number(t?.hrs_min);
      const hrs_max = Number(t?.hrs_max);
      if (!Number.isFinite(hrs_min) || hrs_min < 0)
        errors.push({ path: `tareas.${i}.hrs_min`, message: "Mínimo inválido." });
      if (!Number.isFinite(hrs_max) || hrs_max < 0)
        errors.push({ path: `tareas.${i}.hrs_max`, message: "Máximo inválido." });
      if (Number.isFinite(hrs_min) && Number.isFinite(hrs_max) && hrs_max < hrs_min)
        errors.push({ path: `tareas.${i}.hrs_max`, message: "Máximo debe ser ≥ mínimo." });
      tareas.push({
        nombre: nom,
        descripcion: String(t?.descripcion ?? "").trim(),
        hrs_min: Number.isFinite(hrs_min) ? hrs_min : 0,
        hrs_max: Number.isFinite(hrs_max) ? hrs_max : 0,
      });
    });

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }
  } else {
    const result = validateEstimacion(body);
    if (!result.ok || !result.data) {
      return NextResponse.json({ errors: result.errors }, { status: 422 });
    }
    programador_id = result.data.programador_id;
    nombre_solicitud = result.data.nombre_solicitud;
    notas = result.data.notas;
    proyecto_clickup_id = result.data.proyecto_clickup_id;
    proyecto_nombre = result.data.proyecto_nombre;
    buffer_porcentaje = result.data.buffer_porcentaje;
    tareas = result.data.tareas;
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
    .eq("id", programador_id)
    .maybeSingle();

  if (progErr || !prog || !prog.activo) {
    return NextResponse.json(
      { errors: [{ path: "programador_id", message: "Estimador no válido." }] },
      { status: 422 }
    );
  }

  const totalMin = tareas.reduce((s, t) => s + t.hrs_min, 0);
  const totalMax = tareas.reduce((s, t) => s + t.hrs_max, 0);

  // `prioridad` no forma parte del payload validado (compartido con el
  // formulario del programador, que no la usa) — se lee directo del body.
  const prioridadRaw = raw["prioridad"];
  const prioridad = ["alta", "media", "baja"].includes(String(prioridadRaw))
    ? String(prioridadRaw)
    : "media";

  // Horas a enviar — solo si el creador (admin) ya las eligió. min/pert/max
  // se calculan sobre las horas SIN buffer, igual que /horas-envio.
  let horasEnvio: number | null = null;
  const horasEnvioTipo = raw["horas_envio_tipo"];
  if (typeof horasEnvioTipo === "string" && tareas.length > 0) {
    if (horasEnvioTipo === "min") horasEnvio = Math.round(totalMin * 10) / 10;
    else if (horasEnvioTipo === "max") horasEnvio = Math.round(totalMax * 10) / 10;
    else if (horasEnvioTipo === "pert")
      horasEnvio = Math.round(((totalMin + totalMax) / 2) * 10) / 10;
    else if (horasEnvioTipo === "custom") {
      const c = Number(raw["horas_envio_custom"]);
      horasEnvio = Number.isFinite(c) && c > 0 ? Math.round(c * 10) / 10 : null;
    }
  }

  const estado = guardarBorrador ? "por_estimar" : "pendiente_revision_interna";

  const { data: inserted, error: insErr } = await supa
    .from("cotizaciones")
    .insert({
      nombre: nombre_solicitud,
      nombre_original: nombre_solicitud,
      programador_id: prog.id,
      canal_entrada: "formulario",
      notas_programador: notas ?? null,
      proyecto_clickup_id: proyecto_clickup_id ?? null,
      proyecto_nombre: proyecto_nombre ?? null,
      buffer_porcentaje: buffer_porcentaje ?? 0,
      prioridad,
      horas_min: Math.round(totalMin),
      horas_max: Math.round(totalMax),
      horas_envio: horasEnvio,
      estado,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "No se pudo guardar la estimación." }, { status: 500 });
  }

  const tareasRows = tareas.map((t, i) => ({
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
    tipo_accion: guardarBorrador ? "creada_manual" : "creada_desde_formulario",
    metadata: { programador: prog.nombre },
  });

  // Push a Johana — se salta por completo cuando `notificar` viene explícito
  // en false (ella misma está creando el registro, no tiene sentido avisarle).
  const notificar = raw["notificar"] !== false;
  if (notificar) {
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
        body: `${prog.nombre} envió "${nombre_solicitud}" (${totalMin}–${totalMax} hrs)`,
        url: `/panel/cotizaciones/${inserted.id}`,
        tag: `estimacion-${inserted.id}`,
        badgeCount,
      });
    } catch (e) {
      console.error("[push] error:", e);
    }
  }

  // Invalidar caches para que la nueva estimación aparezca de inmediato en:
  //   - /panel (badge del sidebar + contadores del dashboard)
  //   - /panel/cotizaciones (listado general, incluye las tempranas)
  revalidatePath("/panel");
  revalidatePath("/panel/cotizaciones");

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 });
}
