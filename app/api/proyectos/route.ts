// GET  /api/proyectos → listado, con búsqueda por nombre y filtro de activos.
// POST /api/proyectos → alta rápida (solo nombre + contacto_principal obligatorios).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { COLOR_PROYECTO_DEFAULT, esColorProyectoValido } from "@/lib/proyectos/colores";
import { EMOJI_PROYECTO_DEFAULT, esEmojiProyectoValido } from "@/lib/proyectos/emojis";

export const runtime = "nodejs";

type CrearProyectoBody = {
  nombre: string;
  contacto_principal: string;
  rfc?: string | null;
  correo?: string | null;
  telefono?: string | null;
  precio_hora_venta?: number | null;
  moneda_hora?: "MXN" | "USD";
  color?: string;
  emoji?: string;
  notas?: string | null;
  contactos_facturacion?: { correo: string; nombre?: string | null }[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONEDAS_VALIDAS = ["MXN", "USD"];

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [] });
  }

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const todos = url.searchParams.get("todos") === "1";

  const supa = createSupabaseServiceClient();
  const construir = (sel: string) => {
    let q2 = supa.from("proyectos").select(sel).order("nombre", { ascending: true }).limit(500);
    if (!todos) q2 = q2.eq("activo", true);
    if (q) q2 = q2.ilike("nombre", `%${q}%`);
    return q2;
  };

  let { data, error }: { data: any; error: any } = await construir(
    "id, nombre, contacto_principal, rfc, correo, telefono, precio_hora_venta, moneda_hora, color, emoji, activo, created_at"
  );
  // Degradación si la migración de `emoji` todavía no se corrió.
  if (error && /emoji/i.test(error.message)) {
    ({ data, error } = await construir(
      "id, nombre, contacto_principal, rfc, correo, telefono, precio_hora_venta, moneda_hora, color, activo, created_at"
    ));
  }
  if (error) {
    console.error("[proyectos] error listando:", error);
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

  let body: CrearProyectoBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  const contacto = body.contacto_principal?.trim();
  if (!nombre) {
    return NextResponse.json({ error: "Falta el nombre del proyecto" }, { status: 422 });
  }
  if (!contacto) {
    return NextResponse.json({ error: "Falta el contacto principal" }, { status: 422 });
  }
  const moneda = body.moneda_hora ?? "MXN";
  if (!MONEDAS_VALIDAS.includes(moneda)) {
    return NextResponse.json({ error: "Moneda inválida" }, { status: 422 });
  }
  const color = body.color ?? COLOR_PROYECTO_DEFAULT;
  if (!esColorProyectoValido(color)) {
    return NextResponse.json({ error: "Color de etiqueta inválido" }, { status: 422 });
  }
  const emoji = body.emoji ?? EMOJI_PROYECTO_DEFAULT;
  if (!esEmojiProyectoValido(emoji)) {
    return NextResponse.json({ error: "Emoji inválido" }, { status: 422 });
  }

  // Contactos de facturación: filtramos vacíos y validamos formato antes de
  // tocar la base — si alguno está mal, no se crea nada.
  const contactosRaw = Array.isArray(body.contactos_facturacion)
    ? body.contactos_facturacion
    : [];
  const contactos = contactosRaw
    .map((c) => ({ correo: c.correo?.trim().toLowerCase() ?? "", nombre: c.nombre?.trim() || null }))
    .filter((c) => c.correo.length > 0);
  const invalido = contactos.find((c) => !EMAIL_RE.test(c.correo));
  if (invalido) {
    return NextResponse.json(
      { error: `Correo de facturación inválido: ${invalido.correo}` },
      { status: 422 }
    );
  }

  const supa = createSupabaseServiceClient();
  const nuevoProyecto: Record<string, any> = {
    nombre,
    contacto_principal: contacto,
    rfc: body.rfc?.trim() || null,
    correo: body.correo?.trim() || null,
    telefono: body.telefono?.trim() || null,
    precio_hora_venta: body.precio_hora_venta ?? 0,
    moneda_hora: moneda,
    color,
    emoji,
    notas: body.notas?.trim() || null,
  };
  let { data, error } = await supa.from("proyectos").insert(nuevoProyecto).select("id").single();
  // Degradación si la migración de `emoji` todavía no se corrió.
  if (error && /emoji/i.test(error.message)) {
    const sinEmoji = { ...nuevoProyecto };
    delete sinEmoji.emoji;
    ({ data, error } = await supa.from("proyectos").insert(sinEmoji).select("id").single());
  }

  if (error || !data) {
    console.error("[proyectos] error creando:", error);
    return NextResponse.json({ error: error?.message || "No se pudo crear el proyecto" }, { status: 500 });
  }

  if (contactos.length > 0) {
    const { error: errContactos } = await supa
      .from("proyectos_contactos_facturacion")
      .insert(contactos.map((c) => ({ proyecto_id: data.id, correo: c.correo, nombre: c.nombre })));
    if (errContactos) {
      // El proyecto ya se creó; solo avisamos que los contactos no se guardaron.
      console.error("[proyectos] error guardando contactos de facturación:", errContactos);
      revalidatePath("/panel/proyectos");
      return NextResponse.json({
        ok: true,
        id: data.id,
        warning: "El proyecto se creó, pero los contactos de facturación no se pudieron guardar.",
      });
    }
  }

  revalidatePath("/panel/proyectos");
  return NextResponse.json({ ok: true, id: data.id });
}
