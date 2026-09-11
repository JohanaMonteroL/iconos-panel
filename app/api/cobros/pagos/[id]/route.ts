// DELETE /api/cobros/pagos/[id] — quita un pago registrado por error.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "cobros-facturas";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const supa = createSupabaseServiceClient();
  const { data: pago, error: getErr } = await supa
    .from("cobros_pagos")
    .select("id, periodo_id, comprobante_path")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !pago) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const { error: delErr } = await supa.from("cobros_pagos").delete().eq("id", params.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (pago.comprobante_path) {
    await supa.storage.from(BUCKET).remove([pago.comprobante_path]);
  }

  revalidatePath(`/panel/cobros/${pago.periodo_id}`);
  revalidatePath("/panel/cobros");
  return NextResponse.json({ ok: true });
}
