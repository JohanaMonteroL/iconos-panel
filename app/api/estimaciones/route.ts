import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validateEstimacion } from "@/lib/validation";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push/webpush";

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

  const { data: inserted, error: insErr } = await supa
    .from("estimaciones_formulario")
    .insert({
      programador_id: prog.id,
      datos_raw: {
        nombre_solicitud: result.data.nombre_solicitud,
        notas: result.data.notas ?? null,
        proyecto_clickup_id: result.data.proyecto_clickup_id ?? null,
        proyecto_nombre: result.data.proyecto_nombre ?? null,
        buffer_porcentaje: result.data.buffer_porcentaje ?? 0,
        tareas: result.data.tareas,
      },
      estado: "recibida",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "No se pudo guardar la estimación." }, { status: 500 });
  }

  // Push a Johana — awaited para que la función serverless no se termine antes
  // de mandar el push (era la causa por la que no llegaban las notificaciones
  // de "nueva estimación" pero sí las de cotización, que viene de un flow más largo).
  const totalMin = result.data.tareas.reduce((s, t) => s + t.hrs_min, 0);
  const totalMax = result.data.tareas.reduce((s, t) => s + t.hrs_max, 0);

  // Contar estimaciones pendientes para el badge del PWA — mismo criterio
  // que el sidebar y el dashboard: sin cotización + no archivada + no revisada.
  let badgeCount = 0;
  try {
    const r = await supa
      .from("estimaciones_formulario")
      .select("id", { count: "exact", head: true })
      .is("cotizacion_ref", null)
      .is("revisada_at", null)
      .in("estado", ["recibida", "procesada_ia", "en_revision"]);
    if (r.error && /revisada_at|column/i.test(r.error.message)) {
      const r2 = await supa
        .from("estimaciones_formulario")
        .select("id", { count: "exact", head: true })
        .is("cotizacion_ref", null)
        .in("estado", ["recibida", "procesada_ia", "en_revision"]);
      badgeCount = r2.count ?? 0;
    } else {
      badgeCount = r.count ?? 0;
    }
  } catch {}

  try {
    await sendPushToAll({
      title: "Nueva estimación recibida",
      body: `${prog.nombre} envió "${result.data.nombre_solicitud}" (${totalMin}–${totalMax} hrs)`,
      url: `/panel/estimaciones/${inserted.id}`,
      tag: `estimacion-${inserted.id}`,
      badgeCount,
    });
  } catch (e) {
    console.error("[push] error:", e);
  }

  // Invalidar caches para que la nueva estimación aparezca de inmediato en:
  //   - /panel (badge del sidebar + contadores del dashboard)
  //   - /panel/estimaciones (listado de estimaciones recibidas)
  // El layout también re-renderea el badge porque está en revalidatePath('/panel').
  revalidatePath("/panel");
  revalidatePath("/panel/estimaciones");

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 });
}
