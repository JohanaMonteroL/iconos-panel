// POST /api/cobros/periodos/[id]/cambiar-estado
//
// Cambia el estado del período. A diferencia de "enviada" en Cotizaciones,
// NINGÚN estado de Período —incluido "facturado"— exige tener una factura
// cargada primero: la factura (PDF/XML) es siempre opcional y solo se
// muestra como nota informativa (ver lib/cobros/calculos.ts#estadoFactura).
//
// Al pasar a "facturado" el período se da por cobrado: si falta algo por
// pagar se registra un pago por ese pendiente (igual que "Marcar como
// pagada" en el detalle), marcado con NOTA_PAGO_AUTOMATICO. Si después el
// período sale de "facturado", ese pago automático se borra; los pagos
// capturados a mano nunca se tocan.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ESTADOS_COBRO_PERIODO } from "@/lib/estados/cobros";
import { NOTA_PAGO_AUTOMATICO, pendientePeriodo } from "@/lib/cobros/calculos";
import { hoyISO } from "@/lib/dates";

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
    .select("id, estado, monto")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !periodo) {
    return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
  }

  const entraAFacturado = nuevo === "facturado" && periodo.estado !== "facturado";
  const saleDeFacturado = periodo.estado === "facturado" && nuevo !== "facturado";

  // El pago va ANTES del cambio de estado: si falla, no cambia nada.
  let pagoAutomatico: { id: string; monto: number } | null = null;
  if (entraAFacturado) {
    const { data: pagos, error: pagosErr } = await supa
      .from("cobros_pagos")
      .select("monto")
      .eq("periodo_id", params.id);
    if (pagosErr) {
      return NextResponse.json({ error: `No se pudo calcular lo pagado: ${pagosErr.message}` }, { status: 500 });
    }
    // Redondeo a centavos para no registrar residuos de punto flotante.
    const pendiente = Math.round(pendientePeriodo(periodo, pagos ?? []) * 100) / 100;
    if (pendiente > 0) {
      const { data: pago, error: insErr } = await supa
        .from("cobros_pagos")
        .insert({ periodo_id: params.id, monto: pendiente, fecha: hoyISO(), notas: NOTA_PAGO_AUTOMATICO })
        .select("id")
        .single();
      if (insErr || !pago) {
        return NextResponse.json(
          { error: `No se pudo registrar el pago automático: ${insErr?.message ?? "sin respuesta"}` },
          { status: 500 }
        );
      }
      pagoAutomatico = { id: pago.id, monto: pendiente };
    }
  }

  const { error: updErr } = await supa
    .from("cobros_periodos")
    .update({ estado: nuevo })
    .eq("id", params.id);
  if (updErr) {
    if (pagoAutomatico) await supa.from("cobros_pagos").delete().eq("id", pagoAutomatico.id);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Al salir de "facturado" se quita solo el pago automático; los pagos
  // capturados a mano se quedan. Si falla, el estado ya cambió: se avisa.
  let aviso: string | null = null;
  if (saleDeFacturado) {
    const { error: delErr } = await supa
      .from("cobros_pagos")
      .delete()
      .eq("periodo_id", params.id)
      .eq("notas", NOTA_PAGO_AUTOMATICO);
    if (delErr) {
      console.error("[cobros] no se pudo quitar el pago automático:", delErr);
      aviso = "Se cambió el estado, pero no se pudo quitar el pago automático. Quítalo desde el detalle del cobro.";
    }
  }

  revalidatePath(`/panel/cobros/${params.id}`);
  revalidatePath("/panel/cobros");
  return NextResponse.json({ ok: true, pagoAutomatico: pagoAutomatico?.monto ?? null, aviso });
}
