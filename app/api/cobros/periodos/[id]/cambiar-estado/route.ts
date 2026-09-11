// POST /api/cobros/periodos/[id]/cambiar-estado
//
// Cambia el estado del período. A diferencia de "enviada" en Cotizaciones,
// NINGÚN estado de Período —incluido "facturado"— exige tener una factura
// cargada primero: la factura (PDF/XML) es siempre opcional y solo se
// muestra como nota informativa (ver lib/cobros/calculos.ts#estadoFactura).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ESTADOS_COBRO_PERIODO } from "@/lib/estados/cobros";

export const runtime = "nodejs";

const ESTADOS_VALIDOS: readonly string[] = ESTADOS_COBRO_PERIODO;

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

  const nuevo = String(body?.estado ?? "");
  if (!ESTADOS_VALIDOS.includes(nuevo)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();

  const { data: periodo, error: getErr } = await supa
    .from("cobros_periodos")
    .select("id, estado")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !periodo) {
    return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
  }

  const { error: updErr } = await supa
    .from("cobros_periodos")
    .update({ estado: nuevo })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  revalidatePath(`/panel/cobros/${params.id}`);
  revalidatePath("/panel/cobros");
  return NextResponse.json({ ok: true });
}
