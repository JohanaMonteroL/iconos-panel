// GET /api/buscar?q=... — búsqueda global del buscador del sidebar.
// Junta resultados de Proyectos, Cotizaciones y Cobros (por período) en un
// solo request, hasta 5 por categoría, para el ⌘K del menú.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LIMITE_POR_CATEGORIA = 5;

export type ResultadoBusqueda = {
  tipo: "proyecto" | "cotizacion" | "cobro";
  id: string;
  titulo: string;
  subtitulo: string | null;
  href: string;
  meta?: { color?: string | null; emoji?: string | null; estado?: string | null };
};

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ resultados: [] });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ resultados: [] });
  }

  const supa = createSupabaseServiceClient();
  const like = `%${q}%`;

  const [proyectosRes, cotizacionesRes, periodosRes] = await Promise.all([
    supa
      .from("proyectos")
      .select("id, nombre, color, emoji, activo")
      .ilike("nombre", like)
      .order("nombre")
      .limit(LIMITE_POR_CATEGORIA),
    supa
      .from("cotizaciones")
      .select("id, nombre, estado, proyecto_nombre")
      .ilike("nombre", like)
      .order("created_at", { ascending: false })
      .limit(LIMITE_POR_CATEGORIA),
    supa
      .from("cobros_periodos")
      .select("id, etiqueta, estado, cobros(titulo)")
      .ilike("etiqueta", like)
      .order("created_at", { ascending: false })
      .limit(LIMITE_POR_CATEGORIA),
  ]);

  const resultados: ResultadoBusqueda[] = [];

  for (const p of (proyectosRes.data ?? []) as any[]) {
    resultados.push({
      tipo: "proyecto",
      id: p.id,
      titulo: p.nombre,
      subtitulo: p.activo ? "Proyecto activo" : "Proyecto inactivo",
      href: `/panel/proyectos/${p.id}`,
      meta: { color: p.color, emoji: p.emoji },
    });
  }

  for (const c of (cotizacionesRes.data ?? []) as any[]) {
    resultados.push({
      tipo: "cotizacion",
      id: c.id,
      titulo: c.nombre,
      subtitulo: c.proyecto_nombre ?? null,
      href: `/panel/cotizaciones/${c.id}`,
      meta: { estado: c.estado },
    });
  }

  // Si además el título del Cobro (no solo la etiqueta del período) hace
  // match, también lo buscamos aparte para no perder esos casos.
  let periodosPorTitulo: any[] = [];
  if ((periodosRes.data ?? []).length < LIMITE_POR_CATEGORIA) {
    const { data } = await supa
      .from("cobros_periodos")
      .select("id, etiqueta, estado, cobros!inner(titulo)")
      .ilike("cobros.titulo", like)
      .order("created_at", { ascending: false })
      .limit(LIMITE_POR_CATEGORIA);
    periodosPorTitulo = data ?? [];
  }

  const vistos = new Set<string>();
  for (const p of [...((periodosRes.data ?? []) as any[]), ...periodosPorTitulo]) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    const cobro = Array.isArray(p.cobros) ? p.cobros[0] : p.cobros;
    resultados.push({
      tipo: "cobro",
      id: p.id,
      titulo: p.etiqueta,
      subtitulo: cobro?.titulo ?? null,
      href: `/panel/cobros/${p.id}`,
      meta: { estado: p.estado },
    });
  }

  return NextResponse.json({ resultados: resultados.slice(0, 20) });
}
