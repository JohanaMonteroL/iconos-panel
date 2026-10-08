// Auth para administradores adicionales (tabla `administradores`). Comparten
// la misma cookie de sesión que Johana (lib/auth.ts) — el token solo cambia
// de "label" (admin:<id> en vez de "johana") para que getCurrentAdmin()
// sepa a quién resolver. El login original de Johana (solo contraseña,
// tabla `settings`) no se toca.

import bcrypt from "bcryptjs";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

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

export type AdministradorAuth = {
  id: string;
  nombre: string;
  correo: string;
  must_change_password: boolean;
  activo: boolean;
};

export async function findAdministradorByCorreo(
  correo: string
): Promise<(AdministradorAuth & { password_hash: string | null }) | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("administradores")
    .select("id, nombre, correo, password_hash, must_change_password, activo")
    .ilike("correo", correo.trim())
    .maybeSingle();
  if (!data) return null;
  return data as any;
}

export async function getAdministradorById(
  id: string
): Promise<AdministradorAuth | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("administradores")
    .select("id, nombre, correo, must_change_password, activo")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return data as any;
}
