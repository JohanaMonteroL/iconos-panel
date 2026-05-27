// POST /api/tickets/recomendar-horas
// Toma descripción formateada + tipo y devuelve { horas, justificacion }.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { recomendarHorasTicket } from "@/lib/anthropic/recomendar-horas-ticket";
import type { SubTipoTicket, TipoTicket } from "@/lib/jira/format";

export const runtime = "nodejs";
export const maxDuration = 30;

const TIPOS: TipoTicket[] = ["estimacion", "desarrollo", "soporte", "investigacion"];
const SUBTIPOS: SubTipoTicket[] = ["task", "historia", "bug"];

export async function POST(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en el servidor." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const descripcionMd = String(body?.descripcion_md ?? "").trim();
  const tipo = body?.tipo as TipoTicket;
  const subTipo = (body?.sub_tipo as SubTipoTicket | null) ?? null;

  if (!descripcionMd) {
    return NextResponse.json(
      { error: "Falta la descripción para estimar" },
      { status: 422 }
    );
  }
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 422 });
  }
  if (subTipo && !SUBTIPOS.includes(subTipo)) {
    return NextResponse.json({ error: "Sub-tipo inválido" }, { status: 422 });
  }

  try {
    const r = await recomendarHorasTicket({ descripcionMd, tipo, subTipo });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error consultando IA" },
      { status: 500 }
    );
  }
}
