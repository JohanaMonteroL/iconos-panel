// GET /api/pagos/[id]/registros — historial opcional de pagos ejecutados.
// POST /api/pagos/[id]/registros — agregar un registro (fecha, monto, notas).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("pagos_proveedores_registro")
    .select("*")
    .eq("pago_id", params.id)
    .order("fecha", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const fecha = String(body?.fecha ?? "").trim();
  const monto = Number(body?.monto);
  const notas = body?.notas ? String(body.notas).trim() : null;

  const errors: { path: string; message: string }[] = [];
  if (!fecha) errors.push({ path: "fecha", message: "Pon la fecha del pago." });
  if (!Number.isFinite(monto) || monto <= 0) errors.push({ path: "monto", message: "Captura el monto pagado." });
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("pagos_proveedores_registro")
    .insert({ pago_id: params.id, fecha, monto, notas })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath(`/panel/pagos/${params.id}`);
  return NextResponse.json({ ok: true, id: data.id });
}
