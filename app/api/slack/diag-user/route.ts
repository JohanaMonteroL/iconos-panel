// GET /api/slack/diag-user
// Diagnóstico: confirma qué tokens de Slack carga el server, sin exponer
// los valores. Útil para verificar si SLACK_USER_TOKEN se está leyendo
// correctamente.

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const bot = process.env.SLACK_BOT_TOKEN;
  const user = process.env.SLACK_USER_TOKEN;
  const signing = process.env.SLACK_SIGNING_SECRET;
  const channelAdmin = process.env.SLACK_CHANNEL_ADMIN;

  // Probar identidad del user token llamando a auth.test
  let userTokenIdentity: any = null;
  if (user) {
    try {
      const r = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        cache: "no-store",
      });
      userTokenIdentity = await r.json();
    } catch (e: any) {
      userTokenIdentity = { error: e?.message };
    }
  }

  return NextResponse.json({
    SLACK_BOT_TOKEN: {
      presente: !!bot,
      empieza_con_xoxb: bot?.startsWith("xoxb-") ?? false,
      empieza_con_xoxp: bot?.startsWith("xoxp-") ?? false,
      longitud: bot?.length ?? 0,
    },
    SLACK_USER_TOKEN: {
      presente: !!user,
      empieza_con_xoxp: user?.startsWith("xoxp-") ?? false,
      empieza_con_xoxb: user?.startsWith("xoxb-") ?? false,
      longitud: user?.length ?? 0,
      // auth.test devuelve quién es el dueño del token
      identidad: userTokenIdentity
        ? {
            ok: userTokenIdentity.ok,
            user: userTokenIdentity.user,
            user_id: userTokenIdentity.user_id,
            team: userTokenIdentity.team,
            error: userTokenIdentity.error,
          }
        : null,
    },
    SLACK_SIGNING_SECRET: { presente: !!signing, longitud: signing?.length ?? 0 },
    SLACK_CHANNEL_ADMIN: {
      presente: !!channelAdmin,
      empieza_con_C: channelAdmin?.startsWith("C") ?? false,
    },
    cwd: process.cwd(),
  });
}
