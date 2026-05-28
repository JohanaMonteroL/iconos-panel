// POST /api/programador/cambiar-password
// Body: { password_actual, password_nueva }
// El programador debe estar autenticado. Quita el flag must_change_password.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  getProgramadorSession,
  hashPassword,
  verifyPassword,
} from "@/lib/programador/auth";

export const runtime = "nodejs";

const MIN_LEN = 8;

export async function POST(req: NextRequest) {
  const sesion = getProgramadorSession();
  if (!sesion.ok || !sesion.programadorId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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

  const actual = String(body?.password_actual ?? "");
  const nueva = String(body?.password_nueva ?? "");

  if (nueva.length < MIN_LEN) {
    return NextResponse.json(
      { error: `La nueva contraseña debe tener al menos ${MIN_LEN} caracteres` },
      { status: 422 }
    );
  }
  if (nueva === actual) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser diferente a la actual" },
      { status: 422 }
    );
  }

  const supa = createSupabaseServiceClient();
  const { data: prog } = await supa
    .from("programadores")
    .select("id, password_hash, activo")
    .eq("id", sesion.programadorId)
    .maybeSingle();

  if (!prog || !prog.activo || !prog.password_hash) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const ok = await verifyPassword(actual, prog.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "La contraseña actual no coincide" },
      { status: 401 }
    );
  }

  const nuevoHash = await hashPassword(nueva);
  const { error: updErr } = await supa
    .from("programadores")
    .update({
      password_hash: nuevoHash,
      must_change_password: false,
    })
    .eq("id", sesion.programadorId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
