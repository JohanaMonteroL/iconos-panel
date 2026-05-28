// POST /api/programador/login
// Body: { correo, password }
// Devuelve 200 con cookie de sesión seteada. Si el programador tiene
// must_change_password=true, también lo indica para que el cliente redirija
// a /programador/cambiar-password.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  createProgramadorSessionToken,
  findProgramadorByCorreo,
  PROG_SESSION_COOKIE_NAME,
  PROG_SESSION_MAX_AGE_SECONDS,
  verifyPassword,
} from "@/lib/programador/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const correo = String(body?.correo ?? "").trim();
  const password = String(body?.password ?? "");

  if (!correo || !password) {
    return NextResponse.json(
      { error: "Correo y contraseña son requeridos" },
      { status: 422 }
    );
  }

  const prog = await findProgramadorByCorreo(correo);
  if (!prog || !prog.activo || !prog.password_hash) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 }
    );
  }

  const ok = await verifyPassword(password, prog.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 }
    );
  }

  // Actualiza último login
  try {
    const supa = createSupabaseServiceClient();
    await supa
      .from("programadores")
      .update({ ultimo_login_at: new Date().toISOString() })
      .eq("id", prog.id);
  } catch {}

  const token = createProgramadorSessionToken(prog.id);
  const res = NextResponse.json({
    ok: true,
    must_change_password: prog.must_change_password,
    nombre: prog.nombre,
  });
  res.cookies.set(PROG_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROG_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
