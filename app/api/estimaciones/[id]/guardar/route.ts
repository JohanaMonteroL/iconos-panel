import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { EstimacionLimpia } from "@/lib/anthropic/process";

export const runtime = "nodejs";

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

  // Validación mínima.
  const required = [
    "nombre_solicitud",
    "tareas",
    "recomendacion_horas",
    "contexto_sherlyn",
    "borrador_correo",
  ];
  for (const k of required) {
    if (!(k in body)) {
      return NextResponse.json({ error: `Falta ${k}` }, { status: 422 });
    }
  }
  if (!Array.isArray(body.tareas) || body.tareas.length === 0) {
    return NextResponse.json({ error: "Tareas vacías" }, { status: 422 });
  }

  const limpia: EstimacionLimpia = {
    nombre_solicitud: String(body.nombre_solicitud),
    tareas: body.tareas.map((t: any) => ({
      nombre: String(t.nombre ?? ""),
      descripcion: String(t.descripcion ?? ""),
      hrs_min: Number(t.hrs_min) || 0,
      hrs_max: Number(t.hrs_max) || 0,
    })),
    recomendacion_horas: String(body.recomendacion_horas),
    contexto_sherlyn: String(body.contexto_sherlyn),
    borrador_correo: String(body.borrador_correo),
    descripcion_corta:
      typeof body.descripcion_corta === "string" ? body.descripcion_corta : "",
    puntos_clave: Array.isArray(body.puntos_clave)
      ? body.puntos_clave.map((p: unknown) => String(p ?? "")).filter(Boolean)
      : [],
  };

  const supa = createSupabaseServiceClient();
  let { error } = await supa
    .from("estimaciones_formulario")
    .update({
      datos_limpios: limpia,
      ia_recomendacion: limpia.recomendacion_horas,
      estado: "procesada_ia",
    })
    .eq("id", params.id);

  if (error && /check constraint|chk|invalid input/i.test(error.message)) {
    console.warn("[guardar] fallback a 'en_revision' (migración 0003 pendiente).");
    error = (
      await supa
        .from("estimaciones_formulario")
        .update({
          datos_limpios: limpia,
          ia_recomendacion: limpia.recomendacion_horas,
          estado: "en_revision",
        })
        .eq("id", params.id)
    ).error;
  }

  if (error) {
    console.error("[guardar] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/panel/estimaciones/${params.id}`);
  revalidatePath("/panel/estimaciones");
  return NextResponse.json({ ok: true });
}
