// Guarda la preferencia de horas a enviar en el mensaje de Slack
// para esta estimación (tipo: min/pert/max/custom + valor calculado).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TIPOS = ["min", "pert", "max", "custom"] as const;

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

  const tipo = String(body?.tipo ?? "");
  if (!TIPOS.includes(tipo as any)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 422 });
  }
  const horasEnvio = Number(body?.horas_envio);
  if (!Number.isFinite(horasEnvio) || horasEnvio < 0) {
    return NextResponse.json({ error: "horas_envio inválido" }, { status: 422 });
  }
  const custom =
    tipo === "custom" && Number.isFinite(Number(body?.custom))
      ? Number(body.custom)
      : null;

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
    envio: { tipo, custom, horas: horasEnvio },
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
