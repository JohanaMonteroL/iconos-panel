import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminPassword,
  createAdminSessionToken,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { findAdministradorByCorreo, verifyPassword } from "@/lib/admin/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: "Servidor sin configurar (SESSION_SECRET)" },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const correo = String(body?.correo ?? "").trim();
  const password = String(body?.password ?? "");
  if (!password) {
    return NextResponse.json({ error: "Contraseña requerida" }, { status: 422 });
  }

  // Pequeño delay anti fuerza-bruta básica
  await new Promise((r) => setTimeout(r, 250));

  // Con correo → login de un administrador adicional (tabla `administradores`).
  if (correo) {
    const admin = await findAdministradorByCorreo(correo);
    if (!admin || !admin.activo || !admin.password_hash) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
    }
    const ok = await verifyPassword(password, admin.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
    }
    try {
      const supa = createSupabaseServiceClient();
      await supa
        .from("administradores")
        .update({ ultimo_login_at: new Date().toISOString() })
        .eq("id", admin.id);
    } catch {}

    const token = createAdminSessionToken(admin.id);
    const res = NextResponse.json({ ok: true, must_change_password: admin.must_change_password });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  }

  // Sin correo → login legacy de Johana (contraseña única en `settings`/env).
  if (!process.env.ADMIN_PASSWORD_HASH) {
    return NextResponse.json(
      { error: "Servidor sin configurar (ADMIN_PASSWORD_HASH)" },
      { status: 503 }
    );
  }

  const ok = await checkAdminPassword(password);
  if (!ok) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const token = createSessionToken("johana");
  const res = NextResponse.json({ ok: true, must_change_password: false });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
