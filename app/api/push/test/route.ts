// Manda un push de prueba a TODAS las suscripciones registradas.
// Útil para confirmar que el flujo funciona.

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { sendPushToAll } from "@/lib/push/webpush";

export const runtime = "nodejs";

export async function POST() {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  }

  try {
    const r = await sendPushToAll({
      title: "🔔 Push de prueba",
      body: "Si lees esto, las notificaciones están funcionando. " + new Date().toLocaleTimeString("es-MX"),
      url: "/panel",
      tag: "test-push",
    });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
