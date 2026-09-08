// POST /api/cotizaciones/[id]/conceptos
//
// Reemplaza la lista completa de conceptos de una cotización fija.
// Recalcula el monto_fijo y regenera slack_text con buildSlackTextFijo.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildSlackTextFijo } from "@/lib/slack/format";

export const runtime = "nodejs";
export const maxDuration = 30;

type Concepto = {
  concepto: string;
  cantidad: number;
  precio_unitario: number;
};

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

  const conceptos: Concepto[] = (body?.conceptos ?? [])
    .map((c: any) => ({
      concepto: String(c?.concepto ?? "").trim(),
      cantidad: Number(c?.cantidad ?? 0),
      precio_unitario: Number(c?.precio_unitario ?? 0),
    }))
    .filter((c: Concepto) => c.concepto.length > 0 && c.cantidad > 0);

  if (conceptos.length === 0) {
    return NextResponse.json(
      { error: "Debes mandar al menos un concepto con cantidad > 0" },
      { status: 422 }
    );
  }

  const supa = createSupabaseServiceClient();

  // Fetch cotización + programador (para regenerar slack_text)
  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select(
      `id, nombre, contexto_sherlyn, borrador_correo,
       tipo_precio, programadores(nombre)`
    )
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json(
      { error: "Cotización no encontrada" },
      { status: 404 }
    );
  }
  if (cot.tipo_precio !== "fijo") {
    return NextResponse.json(
      { error: "Solo aplica a cotizaciones de tipo 'fijo'" },
      { status: 422 }
    );
  }

  const programadorNombre = (cot as any).programadores?.nombre ?? "—";

  // Reemplazar conceptos
  await supa.from("conceptos_cotizacion").delete().eq("cotizacion_id", params.id);
  const rows = conceptos.map((c, i) => ({
    cotizacion_id: params.id,
    orden: i,
    concepto: c.concepto,
    cantidad: c.cantidad,
    precio_unitario: c.precio_unitario,
  }));
  const { error: insErr } = await supa.from("conceptos_cotizacion").insert(rows);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Recalcular monto_fijo
  const montoTotal = conceptos.reduce(
    (s, c) => s + c.cantidad * c.precio_unitario,
    0
  );

  // Regenerar slack_text con buildSlackTextFijo
  const slackText = buildSlackTextFijo({
    nombreCotizacion: cot.nombre,
    programador: programadorNombre,
    montoFijoMxn: montoTotal,
    descripcionCorta: cot.contexto_sherlyn ?? "",
    conceptos,
    notas: null,
    clickupUrl: null,
  });

  const { error: updErr } = await supa
    .from("cotizaciones")
    .update({
      monto_fijo: montoTotal,
      slack_text: slackText,
    })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: "conceptos_actualizados",
    metadata: { conceptos: conceptos.length, monto_total: montoTotal },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  return NextResponse.json({
    ok: true,
    monto_total: montoTotal,
  });
}
