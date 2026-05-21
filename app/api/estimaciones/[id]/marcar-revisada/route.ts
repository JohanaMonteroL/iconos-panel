// POST /api/estimaciones/[id]/marcar-revisada
// Marca una estimación como "vista por el admin" (resta del badge del sidebar
// y del icono del PWA). Solo escribe la primera vez (idempotente).

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
  // Solo escribe si está null (idempotente). Si la columna aún no existe
  // por migración pendiente, devolvemos ok igual para no romper el flujo.
  const { error } = await supa
    .from("estimaciones_formulario")
    .update({ revisada_at: new Date().toISOString() })
    .eq("id", params.id)
    .is("revisada_at", null);

  if (error && !/revisada_at|column/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/panel");
  revalidatePath("/panel/estimaciones");
  return NextResponse.json({ ok: true });
}
