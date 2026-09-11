// PATCH  /api/cobros/periodos/[id] — edita etiqueta/monto/moneda/mes/año.
// DELETE /api/cobros/periodos/[id] — borra el período; si era el último
//        del cobro, borra el cobro completo también (ya no queda nada que
//        agrupar).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MONEDAS_VALIDAS = ["MXN", "USD"];

export async function PATCH(
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

  const patch: Record<string, any> = {};
  if (body.etiqueta !== undefined) {
    const v = String(body.etiqueta).trim();
    if (!v) return NextResponse.json({ error: "La etiqueta no puede quedar vacía" }, { status: 422 });
    patch.etiqueta = v;
  }
  if (body.monto !== undefined) {
    const v = Number(body.monto);
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 422 });
    }
    patch.monto = v;
  }
  if (body.moneda !== undefined) {
    if (!MONEDAS_VALIDAS.includes(body.moneda)) {
      return NextResponse.json({ error: "Moneda inválida" }, { status: 422 });
    }
    patch.moneda = body.moneda;
  }
  if (body.mes !== undefined) {
    const v = body.mes === null ? null : Number(body.mes);
    if (v != null && (!Number.isInteger(v) || v < 1 || v > 12)) {
      return NextResponse.json({ error: "Mes inválido" }, { status: 422 });
    }
    patch.mes = v;
  }
  if (body.anio !== undefined) {
    const v = body.anio === null ? null : Number(body.anio);
    if (v != null && !Number.isInteger(v)) {
      return NextResponse.json({ error: "Año inválido" }, { status: 422 });
    }
    patch.anio = v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supa = createSupabaseServiceClient();
  const { error } = await supa.from("cobros_periodos").update(patch).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/panel/cobros/${params.id}`);
  revalidatePath("/panel/cobros");
  return NextResponse.json({ ok: true });
}

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

  const { data: periodo, error: getErr } = await supa
    .from("cobros_periodos")
    .select("id, cobro_id, factura_pdf_path, factura_xml_path")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !periodo) {
    return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
  }

  // Los pagos del período se borran en cascada a nivel de base de datos
  // (FK on delete cascade) sin pasar por /api/cobros/pagos/[id], así que
  // sus comprobantes hay que recogerlos aquí antes de borrar para no
  // dejarlos huérfanos en Storage.
  const { data: pagosDelPeriodo } = await supa
    .from("cobros_pagos")
    .select("comprobante_path")
    .eq("periodo_id", params.id);

  const { error: delErr } = await supa
    .from("cobros_periodos")
    .delete()
    .eq("id", params.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const pathsAEliminar = [
    periodo.factura_pdf_path,
    periodo.factura_xml_path,
    ...((pagosDelPeriodo ?? []).map((p) => p.comprobante_path)),
  ].filter((p): p is string => !!p);
  if (pathsAEliminar.length > 0) {
    await supa.storage.from("cobros-facturas").remove(pathsAEliminar);
  }

  const { count } = await supa
    .from("cobros_periodos")
    .select("id", { count: "exact", head: true })
    .eq("cobro_id", periodo.cobro_id);

  let cobroBorrado = false;
  if (!count) {
    const { error: delCobroErr } = await supa
      .from("cobros")
      .delete()
      .eq("id", periodo.cobro_id);
    if (!delCobroErr) cobroBorrado = true;
  }

  revalidatePath("/panel/cobros");
  return NextResponse.json({ ok: true, cobro_borrado: cobroBorrado });
}
