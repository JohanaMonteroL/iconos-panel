// GET /api/tickets/jira-meta
// Devuelve { proyectos, usuarios, prioridades } para alimentar el wizard.
// Usa cache en memoria del server durante 5 minutos para no spamear JIRA.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  jiraConfigured,
  listProjects,
  listAllAssignableUsers,
  listPriorities,
  type JiraProject,
  type JiraUser,
  type JiraPriority,
} from "@/lib/jira/client";

export const runtime = "nodejs";
export const maxDuration = 30;

type Meta = {
  proyectos: JiraProject[];
  usuarios: JiraUser[];
  prioridades: JiraPriority[];
};

let cache: { data: Meta; expiraEn: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!jiraConfigured()) {
    return NextResponse.json(
      {
        error:
          "JIRA no configurado. Configura JIRA_DOMAIN, JIRA_EMAIL y JIRA_API_TOKEN en Vercel.",
      },
      { status: 503 }
    );
  }

  // ?refresh=1 fuerza re-consultar JIRA aunque el cache aún esté vigente.
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!forceRefresh && cache && cache.expiraEn > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const [proyectos, usuarios, prioridades] = await Promise.all([
      listProjects(),
      listAllAssignableUsers(),
      listPriorities(),
    ]);
    const data: Meta = { proyectos, usuarios, prioridades };
    cache = { data, expiraEn: Date.now() + TTL_MS };
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error consultando JIRA" },
      { status: 500 }
    );
  }
}
