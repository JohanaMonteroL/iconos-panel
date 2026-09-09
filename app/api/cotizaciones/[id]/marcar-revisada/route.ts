// POST /api/cotizaciones/[id]/marcar-revisada
// Marca una cotización (en etapa temprana) como "vista por el admin" — resta
// del badge del sidebar y del icono del PWA. Solo escribe la primera vez
// (idempotente). Reemplaza al equivalente de estimaciones_formulario.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true });
  }

  const supa = createSupabaseServiceClient();
  const { error } = await supa
    .from("cotizaciones")
    .update({ revisada_at: new Date().toISOString() })
    .eq("id", params.id)
    .is("revisada_at", null);

  if (error && !/revisada_at|column/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/panel");
  revalidatePath("/panel/estimaciones");
  revalidatePath(`/panel/cotizaciones/${params.id}`);
  return NextResponse.json({ ok: true });
}
