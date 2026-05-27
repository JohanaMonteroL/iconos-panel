// Cliente mínimo de ClickUp REST API.
// Docs: https://clickup.com/api

const BASE = "https://api.clickup.com/api/v2";

function getKey(): string {
  const k = process.env.CLICKUP_API_KEY;
  if (!k) throw new Error("CLICKUP_API_KEY no configurado");
  return k;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": getKey(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ClickUp ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type ClickUpTask = {
  id: string;
  name: string;
  url: string;
  status: { status: string };
  list?: { id: string; name: string };
};

export type CreateTaskInput = {
  list_id: string;
  name: string;
  description?: string;
  status?: string;
  priority?: 1 | 2 | 3 | 4 | null; // 1=urgent ... 4=low
  due_date?: number;
  time_estimate?: number; // milisegundos
  tags?: string[];
  custom_fields?: Array<{ id: string; value: any }>;
  assignees?: number[];
};

export async function createTask(input: CreateTaskInput): Promise<ClickUpTask> {
  const { list_id, description, ...rest } = input;
  // ClickUp renderiza markdown sólo si va en `markdown_description`.
  // Si pasamos descripción, la enviamos en ambos campos por seguridad.
  const body: Record<string, any> = { ...rest };
  if (description !== undefined) {
    body.description = description;
    body.markdown_description = description;
  }

  try {
    return await request<ClickUpTask>(`/list/${list_id}/task`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    // Si falla por status inválido, reintenta sin status (la lista usará el default)
    if (body.status && /status/i.test(e?.message ?? "")) {
      console.warn(
        `[clickup] status "${body.status}" no aceptado, reintentando sin status`
      );
      const sinStatus = { ...body };
      delete sinStatus.status;
      return await request<ClickUpTask>(`/list/${list_id}/task`, {
        method: "POST",
        body: JSON.stringify(sinStatus),
      });
    }
    throw e;
  }
}

/**
 * Resuelve el id del campo personalizado "Proyecto" en la lista Cotizaciones
 * del sprint actual. Devuelve null si no se puede resolver.
 */
export async function getProyectoFieldId(): Promise<string | null> {
  if (!clickUpConfigured()) return null;
  try {
    const listId = await resolveCotizacionesListId();
    if (!listId) return null;
    const { fields } = await listFields(listId);
    return findProyectoField(fields)?.id ?? null;
  } catch {
    return null;
  }
}

// ── Resoluciones genéricas para campos personalizados ──────────────────────

/**
 * Busca un campo personalizado por patrón de nombre dentro de la lista
 * de Cotizaciones del sprint actual.
 */
export async function getFieldByNamePattern(
  pattern: RegExp
): Promise<ClickUpField | null> {
  if (!clickUpConfigured()) return null;
  try {
    const listId = await resolveCotizacionesListId();
    if (!listId) return null;
    const { fields } = await listFields(listId);
    return fields.find((f) => pattern.test(f.name)) ?? null;
  } catch {
    return null;
  }
}

/**
 * En ClickUp los campos tipo "labels" devuelven sus opciones con la propiedad
 * `label` en lugar de `name`. Esta función intenta ambos.
 */
function nombreDeOpcion(opt: any): string {
  return String(opt?.label ?? opt?.name ?? "").toLowerCase();
}

/**
 * Devuelve los option IDs de un campo personalizado tipo "labels" o
 * "drop_down" cuyo display contenga el nombre dado (case-insensitive, todas
 * las palabras presentes).
 */
export async function findOptionIdsByName(
  fieldPattern: RegExp,
  targetName: string
): Promise<{ fieldId: string; optionIds: string[] } | null> {
  const field = await getFieldByNamePattern(fieldPattern);
  if (!field?.type_config?.options) return null;
  const palabras = targetName.toLowerCase().split(/\s+/).filter(Boolean);
  const match = field.type_config.options.find((o: any) => {
    const display = nombreDeOpcion(o);
    return palabras.every((p) => display.includes(p));
  });
  return match ? { fieldId: field.id, optionIds: [match.id] } : null;
}

// ── Miembros del workspace (para asignar tickets) ──────────────────────────

export type ClickUpMember = {
  user: {
    id: number;
    username: string;
    email?: string;
  };
};

export async function listMembers(
  workspaceId: string
): Promise<{ members: ClickUpMember[] }> {
  return request(`/team/${workspaceId}/member`);
}

/**
 * Busca un miembro del workspace cuyo username o email contenga `name`
 * (case-insensitive, todas las palabras presentes). Devuelve user.id o null.
 */
export async function findUserIdByName(name: string): Promise<number | null> {
  const wid = process.env.CLICKUP_WORKSPACE_ID;
  if (!wid || !process.env.CLICKUP_API_KEY) return null;
  try {
    const { members } = await listMembers(wid);
    const palabras = name.toLowerCase().split(/\s+/).filter(Boolean);
    const match = members.find((m) => {
      const u = (m.user.username || "").toLowerCase();
      const e = (m.user.email || "").toLowerCase();
      return palabras.every((p) => u.includes(p) || e.includes(p));
    });
    return match?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el ID de Johana (o el assignee por defecto) usando primero
 * CLICKUP_DEFAULT_ASSIGNEE_ID, y si no, buscando por nombre "Johana".
 */
export async function getDefaultAssigneeId(): Promise<number | null> {
  const envId = process.env.CLICKUP_DEFAULT_ASSIGNEE_ID;
  if (envId) {
    const n = Number(envId);
    if (Number.isFinite(n)) return n;
  }
  return findUserIdByName("johana");
}

export async function updateTaskStatus(taskId: string, status: string): Promise<ClickUpTask> {
  return request<ClickUpTask>(`/task/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await request<unknown>(`/task/${taskId}`, { method: "DELETE" });
}

/**
 * Actualiza la descripción de un ticket existente. ClickUp usa
 * `markdown_content` en updates (no `markdown_description`).
 */
export async function updateTaskDescription(
  taskId: string,
  markdown: string
): Promise<void> {
  await request<unknown>(`/task/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ markdown_content: markdown }),
  });
}

export type ClickUpList = {
  id: string;
  name: string;
  status?: { status: string };
  folder?: { id: string; name: string };
  space?: { id: string; name: string };
};

export async function getList(listId: string): Promise<ClickUpList> {
  return request<ClickUpList>(`/list/${listId}`);
}

// ── Statuses de una lista ─────────────────────────────────────────────────

type ListInfo = {
  id: string;
  name: string;
  statuses?: Array<{ status: string; color?: string; orderindex?: number }>;
};

export async function listStatuses(listId: string): Promise<string[]> {
  try {
    const data = await request<ListInfo>(`/list/${listId}`);
    return (data.statuses ?? []).map((s) => s.status);
  } catch {
    return [];
  }
}

/**
 * Busca en los statuses de una lista el primero que matchee con cualquiera
 * de los candidatos (case-insensitive, primero exacto, luego parcial).
 * Devuelve el nombre exacto como está en ClickUp, o null si nada matchea.
 */
export async function findMatchingStatus(
  listId: string,
  candidates: string[]
): Promise<{ status: string | null; available: string[] }> {
  const available = await listStatuses(listId);
  if (available.length === 0) return { status: null, available: [] };
  const norm = (s: string) => s.toLowerCase().trim();

  // 1) Match exacto
  for (const c of candidates) {
    const m = available.find((s) => norm(s) === norm(c));
    if (m) return { status: m, available };
  }
  // 2) Match parcial (contiene)
  for (const c of candidates) {
    const ncand = norm(c);
    const m = available.find(
      (s) => norm(s).includes(ncand) || ncand.includes(norm(s))
    );
    if (m) return { status: m, available };
  }
  return { status: null, available };
}

// Mapeo de estados internos a candidatos de nombre en ClickUp
export const STATUS_CANDIDATES: Record<string, string[]> = {
  estimado: ["Estimado", "Estimada", "Por estimar", "Estimando", "Por revisar"],
  aprobada: [
    "Por cotizar", // ← Sherlyn ya puede enviar al cliente
    "Lista para enviar",
    "Aprobada",
    "Aprobado",
    "Approved",
    "Aceptada",
  ],
  cambios_solicitados: [
    "Cambios solicitados",
    "Pedir cambios",
    "Pendiente cambios",
    "En revisión",
    "Revisión",
  ],
  en_desarrollo: ["En desarrollo", "Desarrollo", "In progress", "Doing"],
  enviada_cliente: ["Enviada al cliente", "Enviada", "Sent", "Para enviar"],
  archivada: ["Archivada", "Archivado", "Cerrada", "Closed", "Done"],
};

export async function listSpaces(
  workspaceId: string
): Promise<{ spaces: { id: string; name: string }[] }> {
  return request(`/team/${workspaceId}/space?archived=false`);
}

// ── Folders (sprints son folders en ClickUp) ───────────────────────────────

export type ClickUpFolder = {
  id: string;
  name: string;
  archived?: boolean;
  hidden?: boolean;
  orderindex?: number;
  start_date?: string | null;
  due_date?: string | null;
  lists?: Array<{ id: string; name: string; archived?: boolean }>;
};

export async function listFolders(spaceId: string): Promise<{ folders: ClickUpFolder[] }> {
  return request(`/space/${spaceId}/folder?archived=false`);
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

async function listFolderlessLists(
  spaceId: string
): Promise<Array<{ id: string; name: string; archived?: boolean }>> {
  try {
    const data = await request<{
      lists: Array<{ id: string; name: string; archived?: boolean }>;
    }>(`/space/${spaceId}/list?archived=false`);
    return data.lists ?? [];
  } catch {
    return [];
  }
}

/**
 * Resuelve la lista del sprint vigente dentro del Space de Cotizaciones.
 *
 * Soporta varias estructuras de ClickUp:
 *   a) Space → folder "2026" → lista "MAYO (4/5/26 - 31/5/26)"
 *   b) Space → folder "Mayo 2026" → lista "Cotizaciones"
 *   c) Space → lista "Mayo 2026" (folderless)
 *
 * Estrategia:
 *   1. Si está CLICKUP_LIST_COTIZACIONES_ID (override), lo usa.
 *   2. Recolecta TODAS las listas no-archivadas del Space (en folders + folderless).
 *   3. Match preferido: nombre contiene el mes en español + año actual.
 *   4. Fallback: nombre contiene el mes; o contiene "cotiza".
 */
export async function resolveCotizacionesListId(): Promise<string | null> {
  const override = process.env.CLICKUP_LIST_COTIZACIONES_ID;
  if (override) return override;

  const spaceId = process.env.CLICKUP_SPACE_ICONOS_ADMIN;
  if (!spaceId) return null;

  try {
    const allLists: Array<{ id: string; name: string }> = [];

    // Lists dentro de folders
    const { folders } = await listFolders(spaceId);
    for (const folder of folders) {
      if (folder.archived || folder.hidden) continue;
      for (const list of folder.lists ?? []) {
        if (!list.archived) allLists.push({ id: list.id, name: list.name });
      }
    }

    // Lists folderless
    for (const l of await listFolderlessLists(spaceId)) {
      if (!l.archived) allLists.push({ id: l.id, name: l.name });
    }

    if (allLists.length === 0) return null;

    const today = new Date();
    const mes = MESES_ES[today.getMonth()];
    const año = String(today.getFullYear());
    const añoCorto = año.slice(2);

    // 1) Mes + año (largo o corto)
    let match = allLists.find((l) => {
      const n = l.name.toLowerCase();
      return n.includes(mes) && (n.includes(año) || n.includes(añoCorto));
    });
    if (match) return match.id;

    // 2) Solo mes
    match = allLists.find((l) => l.name.toLowerCase().includes(mes));
    if (match) return match.id;

    // 3) Cualquier lista con "cotiza"
    match = allLists.find((l) => /cotiza/i.test(l.name));
    return match?.id ?? null;
  } catch (e) {
    console.error("[clickup] resolveCotizacionesListId:", e);
    return null;
  }
}

export function clickUpConfigured(): boolean {
  // Configurado si hay API key + algo con qué resolver la lista
  return !!(
    process.env.CLICKUP_API_KEY &&
    (process.env.CLICKUP_LIST_COTIZACIONES_ID || process.env.CLICKUP_SPACE_ICONOS_ADMIN)
  );
}

// ── Custom fields ──────────────────────────────────────────────────────────

export type ClickUpFieldOption = {
  id: string;
  name: string;
  color?: string | null;
  orderindex?: number;
};

export type ClickUpField = {
  id: string;
  name: string;
  type: string;
  type_config?: {
    options?: ClickUpFieldOption[];
  };
};

export async function listFields(listId: string): Promise<{ fields: ClickUpField[] }> {
  return request(`/list/${listId}/field`);
}

/**
 * Devuelve las opciones del campo personalizado "Proyecto" en la lista
 * Cotizaciones del sprint actual. Si ClickUp no está configurado o no se
 * puede resolver el sprint, devuelve [].
 */
function findProyectoField(fields: ClickUpField[]): ClickUpField | null {
  // Permite nombres con emojis o sufijos. Ej: "🎯 Proyecto", "Proyecto", "Proyecto cliente"
  return (
    fields.find(
      (f) => f.type === "drop_down" && /\bproyecto\b/i.test(f.name)
    ) ?? null
  );
}

export async function getProyectoOptions(): Promise<ClickUpFieldOption[]> {
  if (!clickUpConfigured()) return [];
  try {
    const listId = await resolveCotizacionesListId();
    if (!listId) return [];
    const { fields } = await listFields(listId);
    const proyectoField = findProyectoField(fields);
    if (!proyectoField?.type_config?.options) return [];
    return [...proyectoField.type_config.options].sort((a, b) => {
      const oa = a.orderindex ?? 0;
      const ob = b.orderindex ?? 0;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });
  } catch (e) {
    console.error("[clickup] getProyectoOptions error:", e);
    return [];
  }
}
