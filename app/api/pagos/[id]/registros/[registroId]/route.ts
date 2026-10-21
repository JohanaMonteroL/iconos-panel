// DELETE /api/pagos/[id]/registros/[registroId] — quitar una fila del historial.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; registroId: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  const supa = createSupabaseServiceClient();
  const { error } = await supa
    .from("pagos_proveedores_registro")
    .delete()
    .eq("id", params.registroId)
    .eq("pago_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath(`/panel/pagos/${params.id}`);
  return NextResponse.json({ ok: true });
}
