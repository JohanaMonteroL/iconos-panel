// GET /api/pagos — lista de pagos (activos por default).
// POST /api/pagos — alta manual de un pago.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PERIODICIDADES, TIPOS_PAGO, COMPROBANTE_TIPOS } from "@/lib/pagos/labels";
import { soloDigitos } from "@/lib/pagos/clabe";
import { esCorreoValido } from "@/lib/pagos/validacion";

export const runtime = "nodejs";

const FORMAS_PAGO = ["automatica", "manual"] as const;

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  const todos = req.nextUrl.searchParams.get("todos") === "1";
  const supa = createSupabaseServiceClient();
  let query = supa.from("pagos_proveedores").select("*").order("orden").order("nombre_pago");
  if (!todos) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
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

  const nombrePago = String(body?.nombre_pago ?? "").trim();
  const empresaContacto = body?.empresa_contacto ? String(body.empresa_contacto).trim() : null;
  const periodicidad = String(body?.periodicidad ?? "mensual");
  const monto = Number(body?.monto ?? 0);
  const iva = Number(body?.iva ?? 0);
  const totalAPagar = Number(body?.total_a_pagar ?? monto + iva);
  const formaPago = String(body?.forma_pago ?? "manual");
  const tipoPago = body?.tipo_pago ? String(body.tipo_pago) : null;
  const bancoOCuenta = body?.banco_o_cuenta ? soloDigitos(String(body.banco_o_cuenta)) : null;
  const titular = body?.titular ? String(body.titular).trim() : null;
  const correoComprobante = body?.correo_comprobante ? String(body.correo_comprobante).trim() : null;
  const comprobanteTipo = String(body?.comprobante_tipo ?? "no_aplica");
  const referencia = body?.referencia ? String(body.referencia).trim() : null;
  const notas = body?.notas ? String(body.notas).trim() : null;

  const errors: { path: string; message: string }[] = [];
  if (!nombrePago) errors.push({ path: "nombre_pago", message: "Pon un nombre para el pago." });
  if (!PERIODICIDADES.includes(periodicidad as any)) {
    errors.push({ path: "periodicidad", message: "Periodicidad inválida." });
  }
  if (!FORMAS_PAGO.includes(formaPago as any)) {
    errors.push({ path: "forma_pago", message: "Forma de pago inválida." });
  }
  if (tipoPago && !TIPOS_PAGO.includes(tipoPago as any)) {
    errors.push({ path: "tipo_pago", message: "Tipo de pago inválido." });
  }
  if (!COMPROBANTE_TIPOS.includes(comprobanteTipo as any)) {
    errors.push({ path: "comprobante_tipo", message: "Comprobante inválido." });
  }
  if (!Number.isFinite(monto) || monto < 0) errors.push({ path: "monto", message: "Monto inválido." });
  if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
    errors.push({ path: "iva", message: "IVA es un porcentaje entre 0 y 100." });
  }
  if (!Number.isFinite(totalAPagar) || totalAPagar < 0) {
    errors.push({ path: "total_a_pagar", message: "Total a pagar inválido." });
  }
  if (correoComprobante && !esCorreoValido(correoComprobante)) {
    errors.push({ path: "correo_comprobante", message: "Ese correo no se ve válido." });
  }
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("pagos_proveedores")
    .insert({
      nombre_pago: nombrePago,
      empresa_contacto: empresaContacto,
      periodicidad,
      monto,
      iva,
      total_a_pagar: totalAPagar,
      forma_pago: formaPago,
      tipo_pago: tipoPago,
      banco_o_cuenta: bancoOCuenta,
      titular,
      correo_comprobante: correoComprobante,
      comprobante_tipo: comprobanteTipo,
      referencia,
      notas,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/panel/pagos");
  return NextResponse.json({ ok: true, id: data.id });
}
