import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const SESSION_COOKIE = "iconos_session";
const SESSION_MAX_DAYS = 30;
const SETTINGS_KEY_PASSWORD = "admin_password_hash";

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET no configurado");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(label = "johana"): string {
  const exp = Date.now() + SESSION_MAX_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${label}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): {
  ok: boolean;
  label?: string;
} {
  if (!token) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false };
  const [label, expStr, sig] = parts;
  const payload = `${label}.${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  } catch {
    return { ok: false };
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return { ok: false };
  return { ok: true, label };
}

function decodeHash(raw: string): string {
  // Si ya viene como bcrypt directo (empieza con $2), devolverlo tal cual.
  if (raw.startsWith("$2")) return raw;
  // Si no, asumir base64 (workaround para que @next/env no expanda los $).
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.startsWith("$2") && decoded.length === 60) return decoded;
  } catch {}
  return raw;
}

// Lee primero de la tabla settings; si no, cae al env var.
async function getAdminPasswordHash(): Promise<string | null> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supa = createSupabaseServiceClient();
      const { data } = await supa
        .from("settings")
        .select("value")
        .eq("key", SETTINGS_KEY_PASSWORD)
        .maybeSingle();
      const v = data?.value as { hash?: string } | null;
      if (v?.hash) return v.hash;
    }
  } catch {}
  return process.env.ADMIN_PASSWORD_HASH || null;
}

export async function checkAdminPassword(plain: string): Promise<boolean> {
  const raw = await getAdminPasswordHash();
  if (!raw) return false;
  const hash = decodeHash(raw);
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function saveAdminPassword(plain: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurado");
  }
  const hash = bcrypt.hashSync(plain, 10);
  const supa = createSupabaseServiceClient();
  // upsert key
  const { error } = await supa.from("settings").upsert(
    { key: SETTINGS_KEY_PASSWORD, value: { hash } },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

export function getSessionFromCookies(): { ok: boolean; label?: string } {
  const c = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(c);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_DAYS * 24 * 60 * 60;
