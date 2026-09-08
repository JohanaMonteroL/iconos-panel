// GET /api/tickets/clickup-meta
// Devuelve { proyectos, usuarios } para alimentar el wizard de tickets.
// "proyectos" son las Listas del Space Desarrollo (una por cliente/proyecto,
// dentro de una carpeta con el mismo nombre).
// Cache en memoria del server durante 5 minutos para no spamear ClickUp.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { clickUpConfigured, listListsInSpace, listMembers } from "@/lib/clickup/client";

export const runtime = "nodejs";
export const maxDuration = 30;

type Proyecto = { id: string; name: string };
type Usuario = { id: string; username: string; email?: string };
type Meta = { proyectos: Proyecto[]; usuarios: Usuario[] };

let cache: { data: Meta; expiraEn: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const spaceId = process.env.CLICKUP_SPACE_TICKETS_DEV;
  if (!clickUpConfigured() || !spaceId) {
    return NextResponse.json(
      {
        error:
          "ClickUp no configurado. Configura CLICKUP_API_KEY y CLICKUP_SPACE_TICKETS_DEV.",
      },
      { status: 503 }
    );
  }

  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!forceRefresh && cache && cache.expiraEn > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const [listas, { members }] = await Promise.all([
      listListsInSpace(spaceId),
      listMembers(process.env.CLICKUP_WORKSPACE_ID_TICKETS!),
    ]);
    const data: Meta = {
      proyectos: listas.map((l) => ({ id: l.id, name: l.name })),
      usuarios: members.map((m) => ({
        id: String(m.user.id),
        username: m.user.username || m.user.email || `Usuario ${m.user.id}`,
        email: m.user.email,
      })),
    };
    cache = { data, expiraEn: Date.now() + TTL_MS };
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error consultando ClickUp" },
      { status: 500 }
    );
  }
}
