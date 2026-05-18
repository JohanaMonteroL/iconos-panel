// Actualiza el buffer aplicado de una estimación.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

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

  const buffer = Number(body?.buffer_porcentaje);
  if (!Number.isFinite(buffer) || buffer < 0 || buffer > 100) {
    return NextResponse.json(
      { error: "Buffer debe estar entre 0 y 100" },
      { status: 422 }
    );
  }

  const supa = createSupabaseServiceClient();
  const { data: est, error } = await supa
    .from("estimaciones_formulario")
    .select("datos_raw")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !est) {
    return NextResponse.json({ error: "Estimación no encontrada" }, { status: 404 });
  }

  const newRaw = {
    ...((est.datos_raw as Record<string, unknown>) ?? {}),
    buffer_porcentaje: buffer,
  };
  const { error: updErr } = await supa
    .from("estimaciones_formulario")
    .update({ datos_raw: newRaw })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  revalidatePath(`/panel/estimaciones/${params.id}`);
  return NextResponse.json({ ok: true });
}
