// Editar campos de un proyecto existente (parcial — solo se actualizan los
// campos que vienen en el body).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { esColorProyectoValido } from "@/lib/proyectos/colores";
import { esEmojiProyectoValido } from "@/lib/proyectos/emojis";

export const runtime = "nodejs";

const MONEDAS_VALIDAS = ["MXN", "USD"];

type Body = {
  nombre?: string;
  contacto_principal?: string;
  rfc?: string | null;
  correo?: string | null;
  telefono?: string | null;
  precio_hora_venta?: number | null;
  moneda_hora?: "MXN" | "USD";
  color?: string;
  emoji?: string;
  notas?: string | null;
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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Record<string, any> = {};
  if (body.nombre !== undefined) {
    const v = body.nombre.trim();
    if (!v) return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 422 });
    patch.nombre = v;
  }
  if (body.contacto_principal !== undefined) {
    const v = body.contacto_principal.trim();
    if (!v) return NextResponse.json({ error: "El contacto principal no puede quedar vacío" }, { status: 422 });
    patch.contacto_principal = v;
  }
  if (body.rfc !== undefined) patch.rfc = body.rfc?.trim() || null;
  if (body.correo !== undefined) patch.correo = body.correo?.trim() || null;
  if (body.telefono !== undefined) patch.telefono = body.telefono?.trim() || null;
  if (body.notas !== undefined) patch.notas = body.notas?.trim() || null;
  if (body.precio_hora_venta !== undefined) {
    patch.precio_hora_venta = body.precio_hora_venta ?? 0;
  }
  if (body.moneda_hora !== undefined) {
    if (!MONEDAS_VALIDAS.includes(body.moneda_hora)) {
      return NextResponse.json({ error: "Moneda inválida" }, { status: 422 });
    }
    patch.moneda_hora = body.moneda_hora;
  }
  if (body.color !== undefined) {
    if (!esColorProyectoValido(body.color)) {
      return NextResponse.json({ error: "Color de etiqueta inválido" }, { status: 422 });
    }
    patch.color = body.color;
  }
  if (body.emoji !== undefined) {
    if (!esEmojiProyectoValido(body.emoji)) {
      return NextResponse.json({ error: "Emoji inválido" }, { status: 422 });
    }
    patch.emoji = body.emoji;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supa = createSupabaseServiceClient();
  let { error } = await supa.from("proyectos").update(patch).eq("id", params.id);
  // Degradación si la migración de `emoji` todavía no se corrió.
  if (error && /emoji/i.test(error.message) && "emoji" in patch) {
    const { emoji: _omitido, ...sinEmoji } = patch;
    if (Object.keys(sinEmoji).length === 0) {
      return NextResponse.json(
        { error: "La migración de emoji no se ha aplicado todavía" },
        { status: 503 }
      );
    }
    ({ error } = await supa.from("proyectos").update(sinEmoji).eq("id", params.id));
  }
  if (error) {
    console.error("[proyectos] error editando:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/panel/proyectos/${params.id}`);
  revalidatePath("/panel/proyectos");
  return NextResponse.json({ ok: true });
}
