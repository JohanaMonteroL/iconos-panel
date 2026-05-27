// GET /api/tickets/diag — diagnóstico de configuración JIRA.
// No expone los valores, solo si están presentes y su longitud.

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const d = process.env.JIRA_DOMAIN;
  const e = process.env.JIRA_EMAIL;
  const t = process.env.JIRA_API_TOKEN;
  return NextResponse.json({
    JIRA_DOMAIN: {
      presente: !!d,
      longitud: d?.length ?? 0,
      empieza_con_https: d?.startsWith("https://") ?? false,
      empieza_con_http: d?.startsWith("http://") ?? false,
      tiene_slash: d?.includes("/") ?? false,
      muestra_primeros_5: d ? d.slice(0, 5) : null,
    },
    JIRA_EMAIL: {
      presente: !!e,
      longitud: e?.length ?? 0,
      contiene_arroba: e?.includes("@") ?? false,
    },
    JIRA_API_TOKEN: {
      presente: !!t,
      longitud: t?.length ?? 0,
      empieza_con_ATATT: t?.startsWith("ATATT") ?? false,
    },
    cwd: process.cwd(),
  });
}
