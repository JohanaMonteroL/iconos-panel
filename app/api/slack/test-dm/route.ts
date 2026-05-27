// POST /api/slack/test-dm
// Body: { email: string, mensaje?: string }
//
// Envía un DM de prueba al correo proporcionado, usando el SLACK_USER_TOKEN
// si está disponible (debería salir como Johana). Te dice exactamente qué
// pasó para debuggear.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  lookupUserIdByEmail,
  postDM,
  slackConfigured,
  userTokenAvailable,
} from "@/lib/slack/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!slackConfigured()) {
    return NextResponse.json(
      { error: "Slack no configurado" },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body?.email ?? "").trim();
  const mensaje =
    String(body?.mensaje ?? "").trim() ||
    "Hola — esto es una prueba del panel de ICONOS. Si lo ves como mi mensaje personal, todo está bien configurado.";

  if (!email) {
    return NextResponse.json({ error: "Falta email" }, { status: 422 });
  }

  const hayUserToken = userTokenAvailable();

  // 1) Lookup del usuario por correo, usando user token si está disponible
  let userId: string | null = null;
  try {
    userId = await lookupUserIdByEmail(email, { useUserToken: hayUserToken });
  } catch (e: any) {
    return NextResponse.json(
      {
        paso: "lookupUserIdByEmail",
        usaUserToken: hayUserToken,
        error: e?.message,
      },
      { status: 500 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        paso: "lookupUserIdByEmail",
        usaUserToken: hayUserToken,
        mensaje: `No se encontró ningún usuario de Slack con el correo "${email}". Verifica que ese correo coincida con el del workspace.`,
      },
      { status: 404 }
    );
  }

  // 2) Mandar el DM con asUser=true (si hay user token, sale como Johana)
  try {
    const r = await postDM({
      userId,
      text: mensaje,
      asUser: hayUserToken,
    });
    return NextResponse.json({
      ok: true,
      usaUserToken: hayUserToken,
      enviadoComo: hayUserToken
        ? "tu cuenta (Johana) — revisa tu carpeta Sent en Slack"
        : "el bot ICONOS Panel",
      ts: r.ts,
      channel: r.channel,
      slack_user_id: userId,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        paso: "postDM",
        usaUserToken: hayUserToken,
        slack_user_id: userId,
        error: e?.message,
      },
      { status: 500 }
    );
  }
}
