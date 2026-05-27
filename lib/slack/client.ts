// Cliente mínimo de Slack Web API + helpers para webhook.
// Docs: https://api.slack.com/methods

import crypto from "crypto";

const SLACK_API = "https://slack.com/api";

export type SlackBlock = Record<string, any>;

export type PostMessageInput = {
  channel: string;
  text: string; // fallback text (también lo que se ve en notificaciones)
  blocks?: SlackBlock[];
};

export type PostMessageResponse = {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
};

function getToken(): string | null {
  return process.env.SLACK_BOT_TOKEN || null;
}

// User token de Johana — opcional. Si está configurado, los DMs a programadores
// se envían "como Johana" en lugar de venir del bot. Se obtiene en
// api.slack.com/apps → tu app → OAuth & Permissions → reinstalar con user
// scopes (chat:write, im:write, users:read.email).
function getUserToken(): string | null {
  return process.env.SLACK_USER_TOKEN || null;
}

export function userTokenAvailable(): boolean {
  return !!process.env.SLACK_USER_TOKEN;
}

export function slackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ADMIN);
}

async function call<T extends { ok: boolean; error?: string }>(
  method: string,
  body: Record<string, any>,
  opts: { useUserToken?: boolean } = {}
): Promise<T> {
  const token = opts.useUserToken ? getUserToken() || getToken() : getToken();
  if (!token) throw new Error("SLACK_BOT_TOKEN no configurado");
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as T;
  if (!json.ok) {
    throw new Error(`Slack ${method} falló: ${json.error || "error desconocido"}`);
  }
  return json;
}

// ── Mensajes ──────────────────────────────────────────────────────────────

export async function postMessage(
  input: PostMessageInput
): Promise<PostMessageResponse> {
  return call<PostMessageResponse>("chat.postMessage", input);
}

export async function updateMessage(input: {
  channel: string;
  ts: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<PostMessageResponse> {
  return call<PostMessageResponse>("chat.update", input);
}

export async function getPermalink(input: {
  channel: string;
  message_ts: string;
}): Promise<{ ok: boolean; permalink?: string; error?: string }> {
  const token = getToken();
  if (!token) throw new Error("SLACK_BOT_TOKEN no configurado");
  const url = new URL(`${SLACK_API}/chat.getPermalink`);
  url.searchParams.set("channel", input.channel);
  url.searchParams.set("message_ts", input.message_ts);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return res.json();
}

// ── DM a un usuario ───────────────────────────────────────────────────────

/**
 * Para mandar un DM, primero hay que abrir el "conversación" (canal IM).
 * Slack devuelve el channel_id que luego se usa con chat.postMessage.
 */
async function openIm(
  userId: string,
  opts: { useUserToken?: boolean } = {}
): Promise<string> {
  const r = await call<{ ok: boolean; channel?: { id: string }; error?: string }>(
    "conversations.open",
    { users: userId },
    opts
  );
  if (!r.channel?.id) throw new Error("No se pudo abrir IM con " + userId);
  return r.channel.id;
}

/**
 * Manda un DM al user_id. Si `asUser=true` y hay SLACK_USER_TOKEN, el mensaje
 * sale desde la cuenta del dueño del token (ej. Johana) en lugar del bot.
 */
export async function postDM(input: {
  userId: string;
  text: string;
  blocks?: SlackBlock[];
  asUser?: boolean;
}): Promise<PostMessageResponse> {
  const useUserToken = !!input.asUser && userTokenAvailable();
  const channel = await openIm(input.userId, { useUserToken });
  return call<PostMessageResponse>(
    "chat.postMessage",
    { channel, text: input.text, blocks: input.blocks },
    { useUserToken }
  );
}

/**
 * Busca el user_id de Slack a partir de un correo. Necesita el scope
 * `users:read.email` en la app (puede ser del bot o del user token).
 * Devuelve null si no se encuentra.
 */
export async function lookupUserIdByEmail(
  email: string,
  opts: { useUserToken?: boolean } = {}
): Promise<string | null> {
  const useUserToken = !!opts.useUserToken && userTokenAvailable();
  const token = useUserToken ? getUserToken() : getToken();
  if (!token) return null;
  const url = new URL(`${SLACK_API}/users.lookupByEmail`);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json()) as {
    ok: boolean;
    user?: { id: string };
    error?: string;
  };
  if (!json.ok || !json.user?.id) return null;
  return json.user.id;
}

/**
 * Atajo: manda un DM resolviendo el correo a user_id internamente.
 * Si `asUser` está activo y SLACK_USER_TOKEN existe, lo manda como ese usuario
 * (típicamente Johana). Si no, fallback al bot.
 * Si el correo no matchea ningún usuario en Slack devuelve null.
 */
export async function postDMByEmail(input: {
  email: string;
  text: string;
  blocks?: SlackBlock[];
  asUser?: boolean;
}): Promise<PostMessageResponse | null> {
  const userId = await lookupUserIdByEmail(input.email, {
    useUserToken: input.asUser,
  });
  if (!userId) return null;
  return postDM({
    userId,
    text: input.text,
    blocks: input.blocks,
    asUser: input.asUser,
  });
}

// ── Verificación de firma para webhooks de Slack ──────────────────────────

/**
 * Slack manda en cada webhook:
 *   X-Slack-Request-Timestamp: <unix epoch>
 *   X-Slack-Signature: v0=<hex>
 * El "v0=..." se computa como HMAC-SHA256(secret, `v0:${timestamp}:${body}`).
 */
export function verifySlackSignature(input: {
  body: string;
  timestamp: string;
  signature: string;
}): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  if (!input.timestamp || !input.signature) return false;

  // Rechaza requests viejos (> 5 min) para mitigar replay
  const now = Math.floor(Date.now() / 1000);
  const t = Number(input.timestamp);
  if (!Number.isFinite(t) || Math.abs(now - t) > 60 * 5) return false;

  const base = `v0:${input.timestamp}:${input.body}`;
  const hmac = crypto.createHmac("sha256", secret).update(base).digest("hex");
  const expected = `v0=${hmac}`;
  try {
    const a = Buffer.from(input.signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Permalink helpers ─────────────────────────────────────────────────────

/**
 * Devuelve la URL pública del mensaje (si el bot tiene scope).
 * Si falla, vuelve null silenciosamente.
 */
export async function safePermalink(
  channel: string,
  ts: string
): Promise<string | null> {
  try {
    const r = await getPermalink({ channel, message_ts: ts });
    return r.ok && r.permalink ? r.permalink : null;
  } catch {
    return null;
  }
}
