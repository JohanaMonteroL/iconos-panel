// POST /api/cotizaciones/formatear-texto
// Body: { tipo: 'correo' | 'sherlyn' | 'slack_admin', texto: string, contexto?: string }
// Devuelve: { texto: string }

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  formatearTextoCotizacion,
  type TipoTexto,
} from "@/lib/anthropic/formatear-texto-cotizacion";

export const runtime = "nodejs";
export const maxDuration = 30;

const TIPOS_VALIDOS: TipoTexto[] = ["correo", "sherlyn", "slack_admin"];

export async function POST(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en el servidor" },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tipo = String(body?.tipo ?? "") as TipoTexto;
  const texto = String(body?.texto ?? "").trim();
  const contexto = body?.contexto ? String(body.contexto).trim() : null;

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 422 });
  }
  if (!texto) {
    return NextResponse.json(
      { error: "Texto vacío — escribe algo primero" },
      { status: 422 }
    );
  }

  try {
    const resultado = await formatearTextoCotizacion({ tipo, texto, contexto });
    return NextResponse.json({ texto: resultado });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error consultando IA" },
      { status: 500 }
    );
  }
}
