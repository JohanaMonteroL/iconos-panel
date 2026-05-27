// Cliente de JIRA Cloud REST v3 + Agile v1.
// Variables de entorno requeridas:
//   JIRA_DOMAIN     (ej. iconos.atlassian.net)
//   JIRA_EMAIL      (cuenta admin)
//   JIRA_API_TOKEN  (https://id.atlassian.com/manage-profile/security/api-tokens)

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  avatarUrl?: string | null;
};

export type JiraUser = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrl?: string | null;
};

export type JiraPriority = {
  id: string;
  name: string; // Highest | High | Medium | Low | Lowest
};

export type JiraStatus = {
  id: string;
  name: string;
  category: "to-do" | "in-progress" | "done" | string;
};

export type JiraSprint = {
  id: number;
  name: string;
  state: "active" | "future" | "closed";
};

export type JiraBoard = {
  id: number;
  name: string;
  type: string;
};

export type JiraIssueType = {
  id: string;
  name: string; // Task | Bug | Story | etc.
};

export type CreateIssuePayload = {
  proyectoKey: string;
  titulo: string;
  descripcionAdf: unknown; // documento ADF
  issueTypeName: string; // Task | Bug | Story
  asignadoAccountId: string;
  prioridadName: string;
  horasEstimadas?: number | null;
  sprintId?: number | null;
  // Carril destino (status name). Si se pasa, se intenta una transition
  // después de crear, porque issues en JIRA siempre nacen en el carril inicial.
  carrilName?: string | null;
};

type JiraOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  // Si es true, no parsea JSON (para DELETE o uploads).
  raw?: boolean;
  headers?: Record<string, string>;
};

export function jiraConfigured(): boolean {
  return Boolean(
    process.env.JIRA_DOMAIN &&
      process.env.JIRA_EMAIL &&
      process.env.JIRA_API_TOKEN
  );
}

function authHeader(): string {
  const email = process.env.JIRA_EMAIL ?? "";
  const token = process.env.JIRA_API_TOKEN ?? "";
  const basic = Buffer.from(`${email}:${token}`).toString("base64");
  return `Basic ${basic}`;
}

function baseUrl(): string {
  const domain = process.env.JIRA_DOMAIN ?? "";
  return `https://${domain}`;
}

async function jiraFetch<T>(path: string, opts: JiraOptions = {}): Promise<T> {
  if (!jiraConfigured()) {
    throw new Error(
      "JIRA no configurado — falta JIRA_DOMAIN / JIRA_EMAIL / JIRA_API_TOKEN."
    );
  }
  const url = path.startsWith("http") ? path : `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    // No cachear nunca llamadas a JIRA en server. El cache de meta lo
    // manejamos manualmente en los endpoints de Next.
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `JIRA ${opts.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`
    );
  }
  if (opts.raw) return undefined as unknown as T;
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// ── Proyectos ───────────────────────────────────────────────────────────

export async function listProjects(): Promise<JiraProject[]> {
  const all: JiraProject[] = [];
  let start = 0;
  const max = 50;
  // Pagina por seguridad si hay más de 50.
  while (true) {
    const resp = await jiraFetch<{
      isLast: boolean;
      values: Array<{
        id: string;
        key: string;
        name: string;
        avatarUrls?: Record<string, string>;
      }>;
    }>(`/rest/api/3/project/search?startAt=${start}&maxResults=${max}`);
    for (const p of resp.values) {
      all.push({
        id: p.id,
        key: p.key,
        name: p.name,
        avatarUrl: p.avatarUrls?.["48x48"] ?? p.avatarUrls?.["32x32"] ?? null,
      });
    }
    if (resp.isLast) break;
    start += max;
    if (start > 500) break; // safety
  }
  return all.sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
}

// ── Usuarios asignables ─────────────────────────────────────────────────

export async function listAssignableUsers(
  projectKey: string
): Promise<JiraUser[]> {
  const data = await jiraFetch<
    Array<{
      accountId: string;
      displayName: string;
      emailAddress?: string;
      active: boolean;
      accountType?: string;
      avatarUrls?: Record<string, string>;
    }>
  >(
    `/rest/api/3/user/assignable/search?project=${encodeURIComponent(
      projectKey
    )}&maxResults=200`
  );
  return data
    .filter((u) => u.active !== false && u.accountType !== "app")
    .map((u) => ({
      accountId: u.accountId,
      displayName: u.displayName,
      emailAddress: u.emailAddress,
      avatarUrl: u.avatarUrls?.["48x48"] ?? u.avatarUrls?.["32x32"] ?? null,
    }))
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" })
    );
}

/**
 * Endpoint admin-only que devuelve correos por accountId. JIRA tiene este
 * endpoint aparte porque el de listing oculta los correos por defecto.
 * Requiere que el dueño del API token sea admin del workspace.
 * https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-user-search/#api-rest-api-3-user-email-bulk-get
 */
export async function bulkUserEmails(
  accountIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (accountIds.length === 0) return map;

  // El endpoint soporta hasta 90 accountIds por llamada — partimos en chunks.
  const CHUNK = 90;
  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const chunk = accountIds.slice(i, i + CHUNK);
    const params = chunk
      .map((id) => `accountId=${encodeURIComponent(id)}`)
      .join("&");
    try {
      const resp = await jiraFetch<{
        users: Array<{ accountId: string; email: string }>;
      }>(`/rest/api/3/user/email/bulk?${params}`);
      for (const u of resp.users ?? []) {
        if (u.email) map.set(u.accountId, u.email);
      }
    } catch {
      // Si falla (sin permisos, p.ej.), seguimos — al menos lo que ya hay.
    }
  }
  return map;
}

// Combina usuarios de varios proyectos sin duplicados (por accountId).
// Útil para el wizard si se quiere ofrecer una lista global.
export async function listAllAssignableUsers(): Promise<JiraUser[]> {
  const projects = await listProjects();
  const map = new Map<string, JiraUser>();
  // Trae usuarios proyecto por proyecto. Conservador (no paralelo) para
  // no spammear la API si hay muchos proyectos.
  for (const p of projects) {
    try {
      const users = await listAssignableUsers(p.key);
      for (const u of users) {
        if (!map.has(u.accountId)) map.set(u.accountId, u);
      }
    } catch {
      // Ignorar errores por proyecto puntual.
    }
  }

  // Enriquecer con correos vía endpoint admin (los de assignable/search
  // suelen venir sin emailAddress por privacy).
  const ids = Array.from(map.keys());
  const emails = await bulkUserEmails(ids);
  emails.forEach((email, id) => {
    const u = map.get(id);
    if (u && !u.emailAddress) {
      map.set(id, { ...u, emailAddress: email });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" })
  );
}

// ── Prioridades ─────────────────────────────────────────────────────────

export async function listPriorities(): Promise<JiraPriority[]> {
  const data = await jiraFetch<JiraPriority[]>(`/rest/api/3/priority`);
  return data.map((p) => ({ id: p.id, name: p.name }));
}

// ── Boards / Sprint activo ──────────────────────────────────────────────

export async function getProjectBoard(
  projectKeyOrId: string
): Promise<JiraBoard | null> {
  const resp = await jiraFetch<{ values: JiraBoard[] }>(
    `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKeyOrId)}&maxResults=10`
  );
  if (!resp.values || resp.values.length === 0) return null;
  // Preferir scrum si hay varios.
  const scrum = resp.values.find((b) => b.type === "scrum");
  return scrum ?? resp.values[0];
}

export async function getActiveSprint(
  projectKeyOrId: string
): Promise<JiraSprint | null> {
  const board = await getProjectBoard(projectKeyOrId);
  if (!board) return null;
  const resp = await jiraFetch<{ values: JiraSprint[] }>(
    `/rest/agile/1.0/board/${board.id}/sprint?state=active&maxResults=5`
  );
  if (!resp.values || resp.values.length === 0) return null;
  return resp.values[0];
}

// ── Carriles (statuses) del proyecto ────────────────────────────────────

export async function listProjectStatuses(
  projectKeyOrId: string
): Promise<JiraStatus[]> {
  // Devuelve statuses agrupados por issuetype. Las unificamos.
  const data = await jiraFetch<
    Array<{
      id: string;
      name: string;
      statuses: Array<{
        id: string;
        name: string;
        statusCategory?: { key?: string };
      }>;
    }>
  >(`/rest/api/3/project/${encodeURIComponent(projectKeyOrId)}/statuses`);
  const map = new Map<string, JiraStatus>();
  for (const t of data) {
    for (const s of t.statuses) {
      if (!map.has(s.name)) {
        map.set(s.name, {
          id: s.id,
          name: s.name,
          category: (s.statusCategory?.key as JiraStatus["category"]) ?? "to-do",
        });
      }
    }
  }
  return Array.from(map.values());
}

// ── Issue types disponibles en el proyecto ──────────────────────────────

export async function listIssueTypes(
  projectKeyOrId: string
): Promise<JiraIssueType[]> {
  const data = await jiraFetch<{
    projects: Array<{
      issuetypes: Array<{ id: string; name: string }>;
    }>;
  }>(
    `/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(
      projectKeyOrId
    )}&expand=projects.issuetypes`
  );
  const types: JiraIssueType[] = [];
  const seen = new Set<string>();
  for (const p of data.projects ?? []) {
    for (const t of p.issuetypes ?? []) {
      if (!seen.has(t.name)) {
        seen.add(t.name);
        types.push({ id: t.id, name: t.name });
      }
    }
  }
  return types;
}

// ── Crear issue ─────────────────────────────────────────────────────────

// Convierte horas decimales a formato JIRA "Xh Ym".
// JIRA no acepta decimales (ej. "2.5h" lo interpreta mal). Usamos minutos
// para preservar la precisión. 2.5 → "2h 30m", 0.5 → "30m", 8 → "8h".
function horasAJiraTime(hours: number): string {
  const totalMin = Math.max(0, Math.round(hours * 60));
  if (totalMin === 0) return "0m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export type CreateIssueResult = {
  id: string;
  key: string;
  url: string;
  sprintWarning?: string | null;
};

export async function createIssue(
  payload: CreateIssuePayload
): Promise<CreateIssueResult> {
  const fields: Record<string, unknown> = {
    project: { key: payload.proyectoKey },
    summary: payload.titulo,
    issuetype: { name: payload.issueTypeName },
    assignee: { accountId: payload.asignadoAccountId },
    priority: { name: payload.prioridadName },
    description: payload.descripcionAdf,
  };

  // Horas estimadas → timetracking en formato JIRA "Xh Ym".
  // IMPORTANTE: al CREATE hay que mandar también `remainingEstimate` o JIRA
  // deja el tracking medio configurado y la UI muestra valores raros.
  if (
    payload.horasEstimadas != null &&
    Number.isFinite(payload.horasEstimadas) &&
    payload.horasEstimadas > 0
  ) {
    const tiempo = horasAJiraTime(payload.horasEstimadas);
    fields.timetracking = {
      originalEstimate: tiempo,
      remainingEstimate: tiempo,
    };
  }

  // Sprint — para proyectos scrum hay un custom field; lo mandamos por
  // nombre estándar de Atlassian si existe.
  if (payload.sprintId) {
    // El custom field de Sprint suele ser customfield_10020 / 10010,
    // varía por sitio. El endpoint de Agile permite agregar al sprint
    // después de crear, eso es más confiable. Lo dejamos para el paso
    // siguiente al create.
  }

  const created = await jiraFetch<{ id: string; key: string }>(
    `/rest/api/3/issue`,
    { method: "POST", body: { fields } }
  );

  // Agregar al sprint activo si lo pasaron (vía endpoint de Agile).
  let sprintWarning: string | null = null;
  if (payload.sprintId) {
    try {
      await jiraFetch(
        `/rest/agile/1.0/sprint/${payload.sprintId}/issue`,
        { method: "POST", body: { issues: [created.key] }, raw: true }
      );
    } catch (e: any) {
      sprintWarning =
        e?.message?.slice(0, 300) ??
        "No se pudo agregar al sprint (puede ser proyecto kanban o permisos).";
    }
  } else {
    sprintWarning = "Sin sprint activo: el ticket quedó en el backlog.";
  }

  // Transition al carril deseado si nos lo pasaron.
  if (payload.carrilName) {
    try {
      await transitionIssueToStatus(created.key, payload.carrilName);
    } catch {
      // No bloqueante.
    }
  }

  const url = `${baseUrl()}/browse/${created.key}`;
  return { id: created.id, key: created.key, url, sprintWarning };
}

// ── Transitions ─────────────────────────────────────────────────────────

export async function transitionIssueToStatus(
  issueKey: string,
  statusName: string
): Promise<void> {
  const transitions = await jiraFetch<{
    transitions: Array<{ id: string; name: string; to: { name: string } }>;
  }>(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`);

  const target = transitions.transitions.find(
    (t) =>
      t.to?.name?.toLowerCase() === statusName.toLowerCase() ||
      t.name?.toLowerCase() === statusName.toLowerCase()
  );
  if (!target) {
    throw new Error(
      `Sin transition disponible hacia "${statusName}" en ${issueKey}. ` +
        `Disponibles: ${transitions.transitions.map((t) => t.to?.name).join(", ")}`
    );
  }
  await jiraFetch(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      method: "POST",
      body: { transition: { id: target.id } },
      raw: true,
    }
  );
}

// ── Update issue ────────────────────────────────────────────────────────

export async function updateIssue(
  issueKey: string,
  patch: {
    titulo?: string;
    descripcionAdf?: unknown;
    prioridadName?: string;
    asignadoAccountId?: string;
    horasEstimadas?: number | null;
    issueTypeName?: string;
  }
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.titulo != null) fields.summary = patch.titulo;
  if (patch.descripcionAdf != null) fields.description = patch.descripcionAdf;
  if (patch.prioridadName) fields.priority = { name: patch.prioridadName };
  if (patch.asignadoAccountId)
    fields.assignee = { accountId: patch.asignadoAccountId };
  if (patch.issueTypeName) fields.issuetype = { name: patch.issueTypeName };
  if (patch.horasEstimadas != null && Number.isFinite(patch.horasEstimadas)) {
    // En PATCH solo movemos originalEstimate; remainingEstimate lo respeta
    // JIRA según lo que ya estaba (el equipo puede haberlo ajustado).
    fields.timetracking = {
      originalEstimate: horasAJiraTime(patch.horasEstimadas),
    };
  }
  if (Object.keys(fields).length === 0) return;
  await jiraFetch(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    { method: "PUT", body: { fields }, raw: true }
  );
}

// ── Delete issue ────────────────────────────────────────────────────────

export async function deleteIssue(issueKey: string): Promise<void> {
  await jiraFetch(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?deleteSubtasks=true`,
    { method: "DELETE", raw: true }
  );
}

// ── Attachments (multipart) ─────────────────────────────────────────────

export async function addAttachment(
  issueKey: string,
  file: { filename: string; contentType: string; bytes: ArrayBuffer | Buffer }
): Promise<void> {
  if (!jiraConfigured())
    throw new Error("JIRA no configurado.");
  const url = `${baseUrl()}/rest/api/3/issue/${encodeURIComponent(
    issueKey
  )}/attachments`;
  const u8 =
    file.bytes instanceof Buffer
      ? new Uint8Array(file.bytes)
      : new Uint8Array(file.bytes);
  const blob = new Blob([u8], { type: file.contentType });
  const fd = new FormData();
  fd.append("file", blob, file.filename);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
    },
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `JIRA attachment ${issueKey} → ${res.status}: ${text.slice(0, 400)}`
    );
  }
}
