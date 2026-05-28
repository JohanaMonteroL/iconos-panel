// Auth para programadores. Cookie distinta al admin (Johana) — un mismo
// browser puede tener ambas sesiones a la vez si hace falta.

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const SESSION_COOKIE = "iconos_programador_session";
const SESSION_MAX_DAYS = 30;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET no configurado");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// El token guarda el id del programador (UUID) para poder filtrar sus datos.
export function createProgramadorSessionToken(programadorId: string): string {
  const exp = Date.now() + SESSION_MAX_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${programadorId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyProgramadorSessionToken(
  token: string | undefined | null
): { ok: boolean; programadorId?: string } {
  if (!token) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false };
  const [programadorId, expStr, sig] = parts;
  const payload = `${programadorId}.${expStr}`;
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
  return { ok: true, programadorId };
}

export function getProgramadorSession(): {
  ok: boolean;
  programadorId?: string;
} {
  const c = cookies().get(SESSION_COOKIE)?.value;
  return verifyProgramadorSessionToken(c);
}

export const PROG_SESSION_COOKIE_NAME = SESSION_COOKIE;
export const PROG_SESSION_MAX_AGE_SECONDS = SESSION_MAX_DAYS * 24 * 60 * 60;

// ── Hash de contraseña ────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hashSync(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// ── Programador login con correo + password ───────────────────────────

export type ProgramadorAuth = {
  id: string;
  nombre: string;
  correo: string;
  must_change_password: boolean;
  activo: boolean;
};

export async function findProgramadorByCorreo(
  correo: string
): Promise<(ProgramadorAuth & { password_hash: string | null }) | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("programadores")
    .select("id, nombre, correo, password_hash, must_change_password, activo")
    .ilike("correo", correo.trim())
    .maybeSingle();
  if (!data) return null;
  return data as any;
}

export async function getProgramadorById(
  id: string
): Promise<ProgramadorAuth | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("programadores")
    .select("id, nombre, correo, must_change_password, activo")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return data as any;
}

/**
 * Helper de páginas: devuelve el programador autenticado o null.
 */
export async function requireProgramador(): Promise<ProgramadorAuth | null> {
  const s = getProgramadorSession();
  if (!s.ok || !s.programadorId) return null;
  const p = await getProgramadorById(s.programadorId);
  if (!p || !p.activo) return null;
  return p;
}
