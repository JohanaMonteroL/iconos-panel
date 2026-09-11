// GET  → lista los correos de facturación de un proyecto.
// POST → agrega uno nuevo (correo obligatorio, nombre opcional).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [] });
  }

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("proyectos_contactos_facturacion")
    .select("id, correo, nombre, created_at")
    .eq("proyecto_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
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

  let body: { correo?: string; nombre?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const correo = body.correo?.trim().toLowerCase();
  if (!correo || !EMAIL_RE.test(correo)) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();

  // El proyecto debe existir.
  const { data: proyecto } = await supa
    .from("proyectos")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!proyecto) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const { data, error } = await supa
    .from("proyectos_contactos_facturacion")
    .insert({
      proyecto_id: params.id,
      correo,
      nombre: body.nombre?.trim() || null,
    })
    .select("id, correo, nombre, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "No se pudo agregar el correo" },
      { status: 500 }
    );
  }

  revalidatePath(`/panel/proyectos/${params.id}`);
  return NextResponse.json({ ok: true, item: data });
}
