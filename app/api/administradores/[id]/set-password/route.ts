// POST /api/administradores/[id]/set-password
// Body: { password?: string }  — si se omite, genera una aleatoria.
//
// Setea contraseña + must_change_password=true para forzar que el
// administrador la cambie en su primer login. Igual que el de programadores.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/admin/auth";

export const runtime = "nodejs";

const MIN_LEN = 8;

// Genera una contraseña razonable: 10 chars alfanuméricos.
function generarPasswordTemporal(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Sin body — se genera aleatoria.
  }

  let password = String(body?.password ?? "").trim();
  let generada = false;
  if (!password) {
    password = generarPasswordTemporal();
    generada = true;
  }
  if (password.length < MIN_LEN) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_LEN} caracteres` },
      { status: 422 }
    );
  }

  const supa = createSupabaseServiceClient();
  const { data: admin } = await supa
    .from("administradores")
    .select("id, correo, activo")
    .eq("id", params.id)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: "Administrador no encontrado" }, { status: 404 });
  }

  const hash = await hashPassword(password);
  const { error: updErr } = await supa
    .from("administradores")
    .update({
      password_hash: hash,
      must_change_password: true,
    })
    .eq("id", params.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  revalidatePath("/panel/settings/administradores");
  return NextResponse.json({
    ok: true,
    password, // se devuelve solo en este request — Johana la copia y la manda al administrador
    generada,
  });
}
