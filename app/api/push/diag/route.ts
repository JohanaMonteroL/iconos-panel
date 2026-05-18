// Diagnóstico de push notifications:
// - VAPID configurado en servidor
// - VAPID público expuesto al cliente
// - Suscripciones registradas en la BD

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
  }

  const result: Record<string, any> = {
    server: {
      vapid_public_key_present: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      vapid_private_key_present: !!process.env.VAPID_PRIVATE_KEY,
      vapid_subject: process.env.VAPID_SUBJECT || null,
      supabase_service_role_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    suscripciones: [] as any[],
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    result.error = "Falta SUPABASE_SERVICE_ROLE_KEY";
    return NextResponse.json(result, { status: 503 });
  }

  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("push_subscriptions")
    .select("id, endpoint, user_label, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    result.error = error.message;
    return NextResponse.json(result, { status: 500 });
  }

  result.suscripciones = (data ?? []).map((s) => ({
    id: s.id,
    user_label: s.user_label,
    created_at: s.created_at,
    endpoint_preview: s.endpoint.slice(0, 60) + "...",
    proveedor: /fcm.googleapis.com/.test(s.endpoint)
      ? "FCM (Chrome / Android)"
      : /web.push.apple.com/.test(s.endpoint)
      ? "APNs (Safari / iOS)"
      : /mozilla|push.services.mozilla/.test(s.endpoint)
      ? "Mozilla"
      : "otro",
  }));

  result.count = result.suscripciones.length;

  return NextResponse.json(result);
}
