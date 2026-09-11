// POST /api/cobros/[id]/periodos
//
// Agrega un período manual a un Cobro existente — el caso de uso principal
// es Desarrollo con varias parcialidades: el primer período ("Pago único")
// lo crea el efecto secundario de cambiar-estado, y Johana agrega los
// siguientes a mano desde el detalle de cualquier período hermano.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MONEDAS_VALIDAS = ["MXN", "USD"];

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

  const etiqueta = String(body?.etiqueta ?? "").trim();
  if (!etiqueta) {
    return NextResponse.json({ error: "La etiqueta no puede quedar vacía" }, { status: 422 });
  }
  const monto = Number(body?.monto);
  if (!Number.isFinite(monto) || monto < 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 422 });
  }
  const moneda = body?.moneda ? String(body.moneda) : undefined;
  if (moneda && !MONEDAS_VALIDAS.includes(moneda)) {
    return NextResponse.json({ error: "Moneda inválida" }, { status: 422 });
  }
  const mes = body?.mes != null ? Number(body.mes) : null;
  if (mes != null && (!Number.isInteger(mes) || mes < 1 || mes > 12)) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 422 });
  }
  const anio = body?.anio != null ? Number(body.anio) : null;
  if (anio != null && !Number.isInteger(anio)) {
    return NextResponse.json({ error: "Año inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();

  const { data: cobro, error: cobroErr } = await supa
    .from("cobros")
    .select("id, moneda")
    .eq("id", params.id)
    .maybeSingle();
  if (cobroErr || !cobro) {
    return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
  }

  const { count } = await supa
    .from("cobros_periodos")
    .select("id", { count: "exact", head: true })
    .eq("cobro_id", params.id);

  const { data: periodo, error: insErr } = await supa
    .from("cobros_periodos")
    .insert({
      cobro_id: params.id,
      estado: "listo_para_cobrar",
      etiqueta,
      monto,
      moneda: moneda ?? cobro.moneda ?? "MXN",
      mes,
      anio,
      orden: count ?? 0,
    })
    .select("id")
    .maybeSingle();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  revalidatePath("/panel/cobros");
  if (periodo?.id) revalidatePath(`/panel/cobros/${periodo.id}`);

  return NextResponse.json({ ok: true, periodo });
}
