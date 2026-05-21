# Tickets JIRA — Plan de implementación

Funcionalidad para que Johana (única admin) cree tickets de trabajo para
programadores en JIRA, ya sea desde cero o a partir de una cotización
aprobada. Wizard guiado en mobile, formulario en una pantalla en desktop.

## Resumen de requerimientos confirmados

- Solo Johana crea los tickets.
- Cada ticket vive en **JIRA** (no en ClickUp) y se replica en Supabase
  para tener un panel de rastreo y poder editar después.
- El programador asignado recibe un **DM de Slack** con link al ticket y
  horas estimadas si las hay.
- El programador y Johana usan el **mismo correo** en JIRA y Slack
  (mapeo por correo).
- Adjuntos solo se suben a JIRA (sin análisis IA), hasta 5 archivos de
  5 MB cada uno. Tipos: imágenes (png/jpg/gif/webp), pdf, docx, xlsx,
  txt, zip.

### Tipos y prefijos de título

| Tipo            | JIRA issue type     | Prefijo título   |
| --------------- | ------------------- | ---------------- |
| Estimación      | Task                | `Estimación: `   |
| Desarrollo      | Task o Historia     | _(ninguno)_      |
| Soporte         | Task o Bug          | `Soporte: `      |
| Investigación   | Task                | `Investigación: `|

### Templates de descripción por tipo

- **Estimación / Desarrollo / Soporte (Task) / Investigación**:
  Objetivo · Condición de éxito · Notas (opcional).
- **Soporte (Bug)**: Problema · Pasos para reproducir · Resultado
  esperado · Resultado actual · Evidencia.
- **Investigación**: además agrega "Preguntas a responder".

### Prioridades

Las estándar de JIRA: Highest, High, Medium, Low, Lowest.

### Sprint

Cada proyecto JIRA tiene un solo board scrum — agarrar el sprint activo
de ese board.

### Carriles

Cada board tiene su carril inicial diferente — Johana lo elige desde el
panel (no se asume "To Do").

## Esquema de datos

Migración `0007_tickets_jira.sql`:

```sql
CREATE TABLE tickets_jira (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_key TEXT NOT NULL UNIQUE,
  jira_url TEXT NOT NULL,

  titulo TEXT NOT NULL,
  descripcion_md TEXT,
  tipo TEXT NOT NULL,         -- estimacion | desarrollo | soporte | investigacion
  sub_tipo TEXT,              -- task | historia | bug
  prioridad TEXT NOT NULL,    -- highest | high | medium | low | lowest
  horas_estimadas NUMERIC,

  asignado_jira_id TEXT NOT NULL,
  asignado_nombre TEXT NOT NULL,
  asignado_correo TEXT,

  proyecto_jira_key TEXT NOT NULL,
  proyecto_jira_nombre TEXT NOT NULL,
  carril TEXT,

  cotizacion_ref UUID REFERENCES cotizaciones(id) ON DELETE SET NULL,
  tarea_estimacion_ref UUID REFERENCES tareas_estimacion(id) ON DELETE SET NULL,

  slack_dm_ts TEXT,
  slack_dm_canal TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX tickets_jira_cotizacion_idx ON tickets_jira(cotizacion_ref);
CREATE INDEX tickets_jira_asignado_idx   ON tickets_jira(asignado_jira_id);
CREATE INDEX tickets_jira_created_idx    ON tickets_jira(created_at DESC);
```

## Librería nueva — `lib/jira/`

- `client.ts` — wrapper sobre la REST v3 de JIRA Cloud:
  - `listProjects()` — lista todos los proyectos (cache 5min).
  - `listAssignableUsers(projectKey)` — usuarios del proyecto (cache 5min).
  - `getActiveSprint(projectKey)` — sprint activo del board scrum del proyecto.
  - `getStatuses(projectKey)` — carriles (status categories) disponibles.
  - `getPriorities()` — lista de prioridades.
  - `createIssue(payload)` — crea ticket.
  - `updateIssue(key, patch)` — edita ticket.
  - `addAttachment(key, file)` — sube archivo a `/issue/{key}/attachments`.
  - `transitionIssue(key, transitionId)` — mueve de carril.
- `format.ts` — convierte ticket interno a payload de JIRA:
  - Markdown → ADF (Atlassian Document Format).
  - Aplica prefijo de título según `tipo`.
  - Mapea `sub_tipo` a `issuetype` de JIRA.
- `prompts.ts` — templates por tipo para la IA de formateo.

## Llamadas a IA — `lib/anthropic/`

- `format-ticket.ts` — UNA sola llamada combinada que devuelve JSON:
  ```json
  { "titulo_corto": "...", "descripcion_formateada": "...markdown..." }
  ```
  Usa prompt caching para abaratar. ~$0.0005 USD por click cacheado.
- `recomendar-horas-ticket.ts` — toma descripción formateada + tipo,
  devuelve `{ horas_estimadas, justificacion }`. ~$0.0005 USD por click.

## Endpoints — `app/api/tickets/`

| Método | Ruta                                      | Función                                                          |
| ------ | ----------------------------------------- | ---------------------------------------------------------------- |
| GET    | `/api/tickets/jira-meta`                  | `{ proyectos, usuarios, prioridades }` (cache 5min en server)    |
| GET    | `/api/tickets/jira-carriles?proyecto=KEY` | Carriles del board del proyecto                                  |
| POST   | `/api/tickets/formatear`                  | IA: texto libre → `{ titulo_corto, descripcion_formateada }`     |
| POST   | `/api/tickets/recomendar-horas`           | IA: sugerencia de horas + justificación                          |
| POST   | `/api/tickets`                            | Crea en JIRA + persiste + DM Slack                               |
| GET    | `/api/tickets`                            | Listado para el panel                                            |
| PATCH  | `/api/tickets/[id]`                       | Edita (sincroniza con JIRA)                                      |
| POST   | `/api/tickets/[id]/adjuntos`              | Sube archivos a JIRA                                             |
| DELETE | `/api/tickets/[id]`                       | Borra en JIRA + panel                                            |

Edición permitida (con sync a JIRA): título, descripción, prioridad,
asignado, horas estimadas, carril, sub_tipo. **No** se permite cambiar
de proyecto JIRA ni de sprint desde el panel.

## UI

### Sidebar
Nuevo item "Tickets" con icono apropiado (Ticket / Hash / ListChecks).

### `/panel/tickets`
Listado con filtros (tipo, proyecto, asignado, fecha). Cards con:
- Título (con prefijo).
- Asignado (avatar + nombre).
- Prioridad (chip de color).
- Proyecto / sprint.
- Link a JIRA externo.

### `/panel/tickets/nuevo` — Wizard

- **Mobile**: pantallas individuales, una pregunta por vez, progress
  bar arriba ("Paso N de 7"). Botones grandes para selección rápida.
- **Desktop**: todo en una sola pantalla con scroll vertical y progress
  bar arriba (o sticky lateral).

Pasos:
1. **Para quién** — grilla de avatares de usuarios JIRA.
2. **Proyecto** — chips / lista buscable.
3. **Tipo y sub-tipo** — botones grandes: Estimación / Desarrollo /
   Soporte / Investigación. Si elige Desarrollo o Soporte, pregunta
   sub-tipo (Task/Historia o Task/Bug). Luego selección de carril.
4. **Descripción** — textarea + botón "Formatear con IA" + dropzone
   adjuntos (opcional). El formateo respeta el template del tipo.
   La descripción puede quedar vacía si la persona ya lo platicó por
   otro lado.
5. **Prioridad** — 5 chips de colores con etiquetas claras.
6. **Horas estimadas** — input numérico + botón "Sugerir con IA"
   (opcional, puede dejar vacío).
7. **Resumen + crear** — vista previa de cómo va a quedar el ticket
   en JIRA, botón "Crear y enviar".

### `/panel/tickets/[id]`
Detalle editable. Cada cambio se sincroniza con JIRA al guardar.
Sección de adjuntos (agregar nuevos). Botón eliminar (con confirmación
tipeada).

### Desde cotización (en `CotizacionAcciones`)

Mostrar botón "Generar tickets en JIRA" solo si `estado IN ('aprobada',
'enviada_cliente')`.

Al hacer click → modal con dos opciones:
- **Un ticket por la cotización completa** → abre wizard pre-llenado
  con título, descripción, horas, etc.
- **Un ticket por cada tarea** → vista grid con N tickets ya
  pre-llenados (uno por tarea de la cotización). Johana edita lo que
  falte y los confirma todos juntos.

## Variables de entorno

En `.env.local` y Vercel:
```
JIRA_DOMAIN=iconos.atlassian.net   # ya confirmado
JIRA_EMAIL=...                      # admin que crea tickets
JIRA_API_TOKEN=...                  # https://id.atlassian.com/manage-profile/security/api-tokens
```

## Plan de entregas

Partir en 4 milestones para no romper nada de golpe:

### M1 — Setup base
- [ ] Migración 0007 (tabla `tickets_jira`).
- [ ] `lib/jira/client.ts` con las funciones core.
- [ ] Endpoints `jira-meta`, `jira-carriles`, `POST /api/tickets`,
      `GET /api/tickets`.
- [ ] Wizard funcional **sin IA** y **sin adjuntos**: solo crea en JIRA
      y persiste en Supabase.
- [ ] DM a Slack al asignado.
- [ ] Sidebar con item "Tickets".

### M2 — IA + adjuntos
- [ ] `format-ticket.ts` + endpoint `/api/tickets/formatear`.
- [ ] `recomendar-horas-ticket.ts` + endpoint
      `/api/tickets/recomendar-horas`.
- [ ] Dropzone de adjuntos + endpoint
      `/api/tickets/[id]/adjuntos`.
- [ ] Botones "Formatear con IA" y "Sugerir horas" en el wizard.

### M3 — Panel + edición
- [ ] `/panel/tickets` con filtros y cards.
- [ ] `/panel/tickets/[id]` editable, con sync a JIRA on-save.
- [ ] PATCH y DELETE endpoints.
- [ ] Confirmación tipeada para eliminar.

### M4 — Cotización → tickets
- [ ] Botón "Generar tickets en JIRA" en `CotizacionAcciones`.
- [ ] Modal con elección "1 ticket vs 1 por tarea".
- [ ] Pre-llenado del wizard / grid múltiple.
- [ ] Vincular `cotizacion_ref` / `tarea_estimacion_ref`.

## Costos estimados IA

- Formatear descripción (titulo+descripción en una llamada): ~$0.0005
  USD por uso con caché caliente.
- Sugerir horas: ~$0.0005 USD por uso con caché caliente.
- ~20 tickets/día con ambos botones = ~$2.40 USD/mes. Despreciable.

## Decisiones pendientes (resueltas)

- ✅ Listar todos los proyectos JIRA (10–20).
- ✅ Todos los usuarios JIRA son asignables.
- ✅ Título corto lo extrae la IA (o Johana puede escribirlo ya
      formateado).
- ✅ Adjuntos solo a JIRA, sin análisis IA.
- ✅ Mapeo Slack ↔ JIRA por correo.
- ✅ Botón "Generar tickets" disponible en `aprobada` y
      `enviada_cliente`.
- ✅ Edición sincroniza a JIRA en todos los campos editables.
