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
  const { data: est, error } = await supa
    .from("estimaciones_formulario")
    .select("id, datos_raw, programadores(nombre)")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !est) {
    return NextResponse.json({ error: "Estimación no encontrada" }, { status: 404 });
  }

  const raw = est.datos_raw as EstimacionCruda;
  const programadorNombre = (est as any).programadores?.nombre ?? "—";

  let limpia;
  try {
    limpia = await procesarEstimacion(raw, programadorNombre);
  } catch (e: any) {
    console.error("[procesar] error IA:", e);
    return NextResponse.json(
      { error: e?.message || "Error procesando con IA" },
      { status: 500 }
    );
  }

  // Intento con el estado nuevo; si la migración 0003 aún no se corrió,
  // el CHECK constraint puede no aceptarlo. Fallback al valor anterior.
  let updErr = (
    await supa
      .from("estimaciones_formulario")
      .update({
        datos_limpios: limpia,
        ia_recomendacion: limpia.recomendacion_horas,
        estado: "procesada_ia",
      })
      .eq("id", params.id)
  ).error;

  if (updErr && /check constraint|chk|invalid input/i.test(updErr.message)) {
    console.warn(
      "[procesar] constraint en 'procesada_ia', cayendo a 'en_revision'. " +
        "Corre la migración 0003."
    );
    updErr = (
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

  if (updErr) {
    console.error("[procesar] update error:", updErr);
    return NextResponse.json(
      { error: `No se pudo guardar: ${updErr.message}` },
      { status: 500 }
    );
  }

  revalidatePath(`/panel/estimaciones/${params.id}`);
  revalidatePath("/panel/estimaciones");

  return NextResponse.json({ ok: true, datos_limpios: limpia });
}
