// GET /api/tickets/clickup-carriles?lista=LIST_ID
// Devuelve { carriles: string[] } — los statuses configurados en esa Lista.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { clickUpConfigured, listStatuses } from "@/lib/clickup/client";

export const runtime = "nodejs";
export const maxDuration = 30;

const cache = new Map<string, { data: string[]; expiraEn: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!clickUpConfigured()) {
    return NextResponse.json({ error: "ClickUp no configurado" }, { status: 503 });
  }
  const lista = req.nextUrl.searchParams.get("lista");
  if (!lista) {
    return NextResponse.json(
      { error: "Falta query param lista=LIST_ID" },
      { status: 400 }
    );
  }

  const cached = cache.get(lista);
  if (cached && cached.expiraEn > Date.now()) {
    return NextResponse.json({ carriles: cached.data });
  }

  try {
    const carriles = await listStatuses(lista);
    cache.set(lista, { data: carriles, expiraEn: Date.now() + TTL_MS });
    return NextResponse.json({ carriles });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error consultando ClickUp" },
      { status: 500 }
    );
  }
}
