import { NextRequest, NextResponse } from "next/server";
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

  // Push a Johana — best-effort, no bloquea respuesta al programador.
  const totalMin = result.data.tareas.reduce((s, t) => s + t.hrs_min, 0);
  const totalMax = result.data.tareas.reduce((s, t) => s + t.hrs_max, 0);
  sendPushToAll({
    title: "Nueva estimación recibida",
    body: `${prog.nombre} envió "${result.data.nombre_solicitud}" (${totalMin}–${totalMax} hrs)`,
    url: `/panel/estimaciones/${inserted.id}`,
    tag: `estimacion-${inserted.id}`,
  }).catch((e) => console.error("[push] error:", e));

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 });
}
