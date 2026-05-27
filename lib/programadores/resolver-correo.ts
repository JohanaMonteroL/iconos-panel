// Helper para encontrar el correo de un programador a partir de su nombre
// (típicamente el displayName que JIRA devuelve en el ticket asignado).
//
// La lógica: si Supabase tiene un programador cuyo `nombre` matchea
// (case-insensitive, ignorando acentos, todas las palabras presentes),
// devolvemos su `correo`. Si hay varios matches, tomamos el primero.

import { createSupabaseServiceClient } from "@/lib/supabase/server";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Devuelve el correo guardado en `programadores`. Estrategia:
 *   1) Match exacto por `jira_account_id` (si lo pasan y existe en BD).
 *   2) Match exacto por `nombre` normalizado (lowercase, sin acentos).
 *   3) Match fuzzy: todas las palabras de uno deben aparecer en el otro.
 * Devuelve null si nada coincide o falta la columna correo.
 */
export async function resolverCorreoProgramador(
  nombre: string | null | undefined,
  jiraAccountId?: string | null
): Promise<string | null> {
  if (!nombre && !jiraAccountId) return null;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supa = createSupabaseServiceClient();
  let resp: { data: any; error: any } = await supa
    .from("programadores")
    .select("nombre, correo, jira_account_id")
    .eq("activo", true);

  // Fallback si la migración 0012 no se aplicó.
  if (resp.error && /jira_account_id/i.test(resp.error.message)) {
    resp = await supa
      .from("programadores")
      .select("nombre, correo")
      .eq("activo", true);
  }
  // Fallback si tampoco existe correo (migración 0011 no aplicada).
  if (resp.error && /correo/i.test(resp.error.message)) {
    return null;
  }
  if (resp.error || !resp.data) return null;

  const rows = resp.data as any[];

  // 1) Match exacto por accountId
  if (jiraAccountId) {
    const exacto = rows.find(
      (p) => p.jira_account_id && p.jira_account_id === jiraAccountId
    );
    if (exacto?.correo) return exacto.correo;
  }

  if (!nombre) return null;

  const target = normalizar(nombre);
  const palabrasTarget = target.split(" ").filter(Boolean);

  // 2) Match exacto por nombre
  for (const p of rows) {
    if (!p.correo) continue;
    if (normalizar(p.nombre) === target) return p.correo;
  }

  // 3) Match fuzzy
  for (const p of rows) {
    if (!p.correo) continue;
    const nombreProg = normalizar(p.nombre);
    const palabrasProg = nombreProg.split(" ").filter(Boolean);
    const matchA = palabrasTarget.every((w) => nombreProg.includes(w));
    const matchB = palabrasProg.every((w) => target.includes(w));
    if (matchA || matchB) return p.correo;
  }

  return null;
}
