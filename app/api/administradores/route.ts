// GET  /api/administradores → listado de administradores adicionales.
// POST /api/administradores → alta (nombre + correo). Sin contraseña — se
// setea aparte con /api/administradores/[id]/set-password, igual que
// programadores.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [] });
  }

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("administradores")
    .select("id, nombre, correo, must_change_password, activo, ultimo_login_at, created_at")
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("[administradores] error listando:", error);
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

  const nombre = String(body?.nombre ?? "").trim();
  const correo = String(body?.correo ?? "").trim();

  if (!nombre) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 422 });
  }
  if (!correo || !EMAIL_RE.test(correo)) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("administradores")
    .insert({ nombre, correo, activo: true })
    .select("id, nombre, correo, must_change_password, activo")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: "Ya existe un administrador con ese correo" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/panel/settings/administradores");
  return NextResponse.json({ ok: true, administrador: data });
}
