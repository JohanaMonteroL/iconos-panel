// GET /api/tickets/jira-carriles?proyecto=KEY
// Devuelve { carriles: [{id, name, category}], sprintActivo }

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  jiraConfigured,
  listProjectStatuses,
  getActiveSprint,
  listIssueTypes,
} from "@/lib/jira/client";

export const runtime = "nodejs";
export const maxDuration = 30;

// Cache por proyecto (5 min) — los carriles casi nunca cambian.
const cache = new Map<string, { data: any; expiraEn: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!jiraConfigured()) {
    return NextResponse.json({ error: "JIRA no configurado" }, { status: 503 });
  }
  const proyecto = req.nextUrl.searchParams.get("proyecto");
  if (!proyecto) {
    return NextResponse.json(
      { error: "Falta query param proyecto=KEY" },
      { status: 400 }
    );
  }

  const cached = cache.get(proyecto);
  if (cached && cached.expiraEn > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const [carriles, sprintActivo, issueTypes] = await Promise.all([
      listProjectStatuses(proyecto),
      getActiveSprint(proyecto),
      listIssueTypes(proyecto),
    ]);
    const data = { carriles, sprintActivo, issueTypes };
    cache.set(proyecto, { data, expiraEn: Date.now() + TTL_MS });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error consultando JIRA" },
      { status: 500 }
    );
  }
}
