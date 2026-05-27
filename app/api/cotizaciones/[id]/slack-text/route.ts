// POST /api/cotizaciones/[id]/slack-text
// Guarda un texto manual del mensaje al jefe. Si se manda vacío, se considera
// "restaurar al auto-generado" y se pone null (en la próxima regeneración se
// vuelve a llenar desde el template).

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

  const textoRaw = body?.slack_text;
  const texto =
    typeof textoRaw === "string" && textoRaw.trim() ? textoRaw : null;

  const supa = createSupabaseServiceClient();
  const { error: updErr } = await supa
    .from("cotizaciones")
    .update({ slack_text: texto })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: "slack_text_editado",
    metadata: { restaurado: texto === null },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  return NextResponse.json({ ok: true });
}
