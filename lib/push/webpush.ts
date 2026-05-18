import webpush from "web-push";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:ia@iconos.mx";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToAll(payload: PushPayload) {
  if (!ensureConfigured()) {
    console.warn("[push] VAPID no configurado, omitiendo envío");
    return { sent: 0, failed: 0 };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[push] SUPABASE_SERVICE_ROLE_KEY ausente, omitiendo envío");
    return { sent: 0, failed: 0 };
  }

  const supa = createSupabaseServiceClient();
  const { data: subs, error } = await supa
    .from("push_subscriptions")
    .select("id, endpoint, keys");
  if (error || !subs) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expired.push(s.id);
        }
      }
    })
  );

  if (expired.length > 0) {
    await supa.from("push_subscriptions").delete().in("id", expired);
  }

  return { sent, failed };
}
