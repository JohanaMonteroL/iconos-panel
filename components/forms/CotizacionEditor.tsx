"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  CheckCircle2,
  Edit3,
  X,
  RefreshCcw,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Archive,
} from "lucide-react";
import ConfirmAccionModal from "@/components/ui/ConfirmAccionModal";

export type CotizacionTarea = {
  id?: string;
  orden: number;
  nombre_limpio: string;
  descripcion_limpia: string | null;
  hrs_min: number;
  hrs_max: number;
};

export type CotizacionData = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  clickup_ticket_id: string | null;
  ia_recomendacion: string | null;
  contexto_sherlyn: string | null;
  borrador_correo: string | null;
  tareas: CotizacionTarea[];
};

type Props = {
  cotizacion: CotizacionData;
};

export default function CotizacionEditor({ cotizacion }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(cotizacion.nombre);
  const [contexto, setContexto] = useState(cotizacion.contexto_sherlyn ?? "");
  const [correo, setCorreo] = useState(cotizacion.borrador_correo ?? "");
  const [tareas, setTareas] = useState<CotizacionTarea[]>(cotizacion.tareas);
  const [comentario, setComentario] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const totalMin = tareas.reduce((s, t) => s + (t.hrs_min || 0), 0);
  const totalMax = tareas.reduce((s, t) => s + (t.hrs_max || 0), 0);

  const cancelar = () => {
    setEditing(false);
    setNombre(cotizacion.nombre);
    setContexto(cotizacion.contexto_sherlyn ?? "");
    setCorreo(cotizacion.borrador_correo ?? "");
    setTareas(cotizacion.tareas);
    setComentario("");
    setError(null);
    setWarning(null);
  };

  const guardar = async () => {
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacion.id}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          contexto_sherlyn: contexto,
          borrador_correo: correo,
          horas_min: totalMin,
          horas_max: totalMax,
          tareas: tareas.map((t, i) => ({
            orden: i,
            nombre_limpio: t.nombre_limpio,
            descripcion_limpia: t.descripcion_limpia,
            hrs_min: t.hrs_min,
            hrs_max: t.hrs_max,
          })),
          comentario: comentario.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al guardar");
        return;
      }
      if (json.clickup_warning) setWarning(json.clickup_warning);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  const updateTarea = (i: number, patch: Partial<CotizacionTarea>) =>
    setTareas(tareas.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeTarea = (i: number) =>
    setTareas(tareas.filter((_, idx) => idx !== i));
  const addTarea = () =>
    setTareas([
      ...tareas,
      {
        orden: tareas.length,
        nombre_limpio: "",
        descripcion_limpia: "",
        hrs_min: 0,
        hrs_max: 0,
      },
    ]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tareas.length) return;
    const copia = [...tareas];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setTareas(copia);
  };

  // ── Vista de lectura ───────────────────────────────────────────────────
  if (!editing) {
    return (
      <>
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-2">Detalle</h2>
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
              <Edit3 size={14} strokeWidth={1.75} />
              <span>Editar</span>
            </button>
          </div>
          <div>
            <div className="text-overline text-text-tertiary mb-1">Nombre</div>
            <div className="text-body-medium">{cotizacion.nombre}</div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading-2">Tareas ({cotizacion.tareas.length})</h2>
          <ul className="space-y-3">
            {cotizacion.tareas.map((t) => (
              <li key={t.id ?? t.orden} className="card card-tight space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-body-medium">{t.nombre_limpio}</h3>
                  <span className="text-caption text-text-tertiary num-tabular whitespace-nowrap">
                    {t.hrs_min}–{t.hrs_max} h
                  </span>
                </div>
                {t.descripcion_limpia && (
                  <p className="text-body text-text-secondary whitespace-pre-wrap">
                    {t.descripcion_limpia}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {cotizacion.contexto_sherlyn && (
          <section className="card">
            <div className="text-overline text-text-tertiary mb-2">Contexto para Sherlyn</div>
            <p className="text-body whitespace-pre-wrap">{cotizacion.contexto_sherlyn}</p>
          </section>
        )}

        {cotizacion.borrador_correo && (
          <section className="card">
            <div className="text-overline text-text-tertiary mb-2">Borrador de correo</div>
            <p className="text-body whitespace-pre-wrap">{cotizacion.borrador_correo}</p>
          </section>
        )}
      </>
    );
  }

  // ── Vista de edición ───────────────────────────────────────────────────
  return (
    <>
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-2">Editando cotización</h2>
          <span className="badge badge-warning">Sin guardar</span>
        </div>
        <div>
          <label className="field-label">Nombre</label>
          <input
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-2">Tareas ({tareas.length})</h2>
          <span className="text-caption text-text-secondary num-tabular">
            Total: {totalMin}–{totalMax} h
          </span>
        </div>
        <ul className="space-y-3">
          {tareas.map((t, i) => (
            <li
              key={t.id ?? i}
              className="rounded-[12px] border overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-3 border-b"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="text-overline text-text-tertiary">Tarea {i + 1}</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="btn-icon btn-sm btn-ghost"
                    aria-label="Subir"
                  >
                    <ChevronUp size={16} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === tareas.length - 1}
                    className="btn-icon btn-sm btn-ghost"
                    aria-label="Bajar"
                  >
                    <ChevronDown size={16} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTarea(i)}
                    className="btn-icon btn-sm btn-ghost"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="field-label">Nombre</label>
                  <input
                    className="input"
                    value={t.nombre_limpio}
                    onChange={(e) => updateTarea(i, { nombre_limpio: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Descripción</label>
                  <textarea
                    className="textarea min-h-[80px]"
                    rows={3}
                    value={t.descripcion_limpia ?? ""}
                    onChange={(e) =>
                      updateTarea(i, { descripcion_limpia: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Mín</label>
                    <input
                      className="input num-tabular"
                      type="number"
                      min={0}
                      value={t.hrs_min}
                      onChange={(e) =>
                        updateTarea(i, { hrs_min: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label">Máx</label>
                    <input
                      className="input num-tabular"
                      type="number"
                      min={0}
                      value={t.hrs_max}
                      onChange={(e) =>
                        updateTarea(i, { hrs_max: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={addTarea} className="btn-secondary">
          <Plus size={16} strokeWidth={1.75} />
          <span>Añadir tarea</span>
        </button>
      </section>

      <section className="card">
        <label className="field-label">Contexto para Sherlyn</label>
        <textarea
          className="textarea min-h-[100px] mt-2"
          rows={4}
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
        />
      </section>

      <section className="card">
        <label className="field-label">Borrador de correo</label>
        <textarea
          className="textarea min-h-[140px] mt-2"
          rows={6}
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </section>

      <section className="card" style={{ background: "var(--bg-surface)" }}>
        <label className="field-label">Comentario sobre estos cambios (opcional)</label>
        <input
          className="input"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Ej. Cliente pidió ajustar pruebas y agregar capacitación"
        />
        <p className="field-hint">Queda registrado en el historial de la cotización.</p>
      </section>

      <div className="space-y-3">
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
        {warning && (
          <div
            className="card card-tight text-caption"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--state-warning)",
              color: "var(--text-secondary)",
            }}
          >
            ⚠️ {warning}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button onClick={guardar} disabled={saving} className="btn-primary">
            <Save size={16} strokeWidth={1.75} />
            <span>{saving ? "Guardando…" : "Guardar cambios"}</span>
          </button>
          <button onClick={cancelar} disabled={saving} className="btn-ghost">
            <X size={16} strokeWidth={1.75} />
            <span>Cancelar</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Acciones rápidas para vista de lectura ─────────────────────────────

type ActionsProps = {
  cotizacionId: string;
  estado: string;
  tieneTicketClickUp: boolean;
};

export function CotizacionAcciones({
  cotizacionId,
  estado,
  tieneTicketClickUp,
}: ActionsProps) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "archivar" | "eliminar">(null);

  const archivar = async ({ checkboxMarcado }: { checkboxMarcado: boolean }) => {
    const res = await fetch(`/api/cotizaciones/${cotizacionId}/cambiar-estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: "archivada",
        borrar_clickup_ticket: checkboxMarcado,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo archivar");
    if (json.clickup_warning) setWarning(json.clickup_warning);
    setModal(null);
    router.refresh();
  };

  const eliminar = async ({ checkboxMarcado }: { checkboxMarcado: boolean }) => {
    const url = `/api/cotizaciones/${cotizacionId}${
      checkboxMarcado ? "?borrar_clickup=1" : ""
    }`;
    const res = await fetch(url, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "No se pudo eliminar");
    if (json.clickup_warning) setWarning(json.clickup_warning);
    setModal(null);
    router.replace("/panel/cotizaciones");
  };

  const cambiarEstado = async (
    nuevo: string,
    extra: { aprobadoPor?: string; comentario?: string } = {}
  ) => {
    setWorking(nuevo);
    setMsg(null);
    setSuccess(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/cambiar-estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: nuevo,
          aprobado_por: extra.aprobadoPor,
          comentario: extra.comentario,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "No se pudo cambiar el estado");
        return;
      }
      if (json.clickup_warning) setWarning(json.clickup_warning);
      router.refresh();
    } catch {
      setMsg("Error de red");
    } finally {
      setWorking(null);
    }
  };

  const reintentarClickUp = async () => {
    setWorking("retry-clickup");
    setMsg(null);
    setSuccess(null);
    setWarning(null);
    try {
      const res = await fetch(
        `/api/cotizaciones/${cotizacionId}/reintentar-clickup`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "No se pudo crear el ticket");
        return;
      }
      router.refresh();
    } catch {
      setMsg("Error de red");
    } finally {
      setWorking(null);
    }
  };

  const reenviarSlack = async () => {
    setWorking("resend-slack");
    setMsg(null);
    setSuccess(null);
    setWarning(null);
    try {
      const res = await fetch(
        `/api/cotizaciones/${cotizacionId}/reenviar-slack`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "No se pudo reenviar");
        return;
      }
      setSuccess("✓ Mensaje reenviado al canal admin");
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    } catch {
      setMsg("Error de red");
    } finally {
      setWorking(null);
    }
  };

  const sincronizarClickUp = async () => {
    setWorking("sync-clickup");
    setMsg(null);
    setSuccess(null);
    setWarning(null);
    try {
      const res = await fetch(
        `/api/cotizaciones/${cotizacionId}/sincronizar-clickup`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "No se pudo sincronizar");
        return;
      }
      if (json.warnings && json.warnings.length > 0) {
        setWarning(json.warnings.join(" · "));
      } else {
        setSuccess(
          `✓ Sincronizado (descripción + ${
            json.customFieldsUpdated ?? 0
          } campos)`
        );
        setTimeout(() => setSuccess(null), 3000);
      }
      router.refresh();
    } catch {
      setMsg("Error de red");
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-heading-2">Acciones</h2>
      <div className="flex flex-wrap gap-3">
        {estado === "esperando_aprobacion" && (
          <button
            disabled={working !== null}
            onClick={() =>
              cambiarEstado("aprobada", { aprobadoPor: "johana" })
            }
            className="btn-primary"
          >
            <CheckCircle2 size={16} strokeWidth={1.75} />
            <span>
              {working === "aprobada" ? "Aprobando…" : "Aprobar yo misma"}
            </span>
          </button>
        )}

        {estado === "aprobada" && (
          <button
            disabled={working !== null}
            onClick={() => cambiarEstado("enviada_cliente")}
            className="btn-secondary"
          >
            <span>
              {working === "enviada_cliente" ? "Marcando…" : "Marcar como enviada al cliente"}
            </span>
          </button>
        )}

        {!tieneTicketClickUp && (
          <button
            disabled={working !== null}
            onClick={reintentarClickUp}
            className="btn-secondary"
          >
            <RefreshCcw size={16} strokeWidth={1.75} />
            <span>
              {working === "retry-clickup" ? "Reintentando…" : "Reintentar ClickUp"}
            </span>
          </button>
        )}

        {tieneTicketClickUp && (
          <button
            disabled={working !== null}
            onClick={sincronizarClickUp}
            className="btn-secondary"
          >
            <Upload size={16} strokeWidth={1.75} />
            <span>
              {working === "sync-clickup"
                ? "Sincronizando…"
                : "Sincronizar con ClickUp"}
            </span>
          </button>
        )}

        <button
          disabled={working !== null}
          onClick={reenviarSlack}
          className="btn-secondary"
        >
          <RefreshCcw size={16} strokeWidth={1.75} />
          <span>{working === "resend-slack" ? "Reenviando…" : "Reenviar Slack"}</span>
        </button>

        {estado !== "archivada" && (
          <button
            disabled={working !== null}
            onClick={() => setModal("archivar")}
            className="btn-ghost"
          >
            <Archive size={16} strokeWidth={1.75} />
            <span>Archivar</span>
          </button>
        )}

        <button
          disabled={working !== null}
          onClick={() => setModal("eliminar")}
          className="btn-ghost"
          style={{ color: "var(--state-error)" }}
        >
          <Trash2 size={16} strokeWidth={1.75} />
          <span>Eliminar permanente</span>
        </button>
      </div>
      {success && (
        <p className="text-caption" style={{ color: "var(--state-success)" }}>
          {success}
        </p>
      )}
      {msg && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {msg}
        </p>
      )}
      {warning && (
        <p className="text-caption" style={{ color: "var(--state-warning)" }}>
          ⚠️ {warning}
        </p>
      )}

      <ConfirmAccionModal
        open={modal === "archivar"}
        onClose={() => setModal(null)}
        onConfirm={archivar}
        titulo="Archivar cotización"
        descripcion={
          <>
            La cotización dejará de aparecer en el listado activo. Podrás
            restaurarla cambiándole el estado más adelante.
          </>
        }
        palabraClave="archivar"
        textoBoton="Sí, archivar"
        checkbox={
          tieneTicketClickUp
            ? {
                label: "También borrar el ticket de ClickUp",
                descripcion:
                  "Se eliminará el ticket asociado en ClickUp de forma permanente. Si lo dejas desmarcado, el ticket queda en ClickUp tal cual.",
              }
            : undefined
        }
      />

      <ConfirmAccionModal
        open={modal === "eliminar"}
        onClose={() => setModal(null)}
        onConfirm={eliminar}
        titulo="Eliminar cotización permanentemente"
        descripcion={
          <>
            Esta acción es <strong>irreversible</strong>. Se borrará la cotización
            de la base de datos junto con sus tareas y el historial. La estimación
            origen quedará libre para reprocesarse.
          </>
        }
        palabraClave="eliminar"
        textoBoton="Eliminar definitivamente"
        peligroso
        checkbox={
          tieneTicketClickUp
            ? {
                label: "También borrar el ticket de ClickUp",
                descripcion:
                  "Se eliminará el ticket asociado en ClickUp. Si lo dejas desmarcado, el ticket queda en ClickUp huérfano.",
              }
            : undefined
        }
      />
    </section>
  );
}

// ─── Log timeline ──────────────────────────────────────────────────────

type LogAccion = {
  id: string;
  tipo_accion: string;
  metadata: Record<string, any> | null;
  created_at: string;
};

const LABEL_ACCION: Record<string, string> = {
  creada_desde_estimacion: "Cotización creada desde estimación",
  ticket_clickup_creado: "Ticket de ClickUp creado",
  ticket_clickup_creado_retry: "Ticket de ClickUp creado (reintento)",
  sync_clickup_manual: "↻ Sincronizado con ClickUp",
  editada: "Cotización editada",
  estado_aprobada: "✅ Aprobada",
  estado_cambios_solicitados: "✏️ Cambios solicitados",
  estado_enviada_cliente: "📤 Enviada al cliente",
  estado_en_desarrollo: "🚧 En desarrollo",
  estado_archivada: "📦 Archivada",
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Tijuana",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CotizacionLog({ acciones }: { acciones: LogAccion[] }) {
  if (acciones.length === 0) return null;
  return (
    <section className="card space-y-3">
      <h2 className="text-heading-2">Historial</h2>
      <ol className="relative pl-4 space-y-3">
        {acciones.map((a, i) => {
          const label = LABEL_ACCION[a.tipo_accion] ?? a.tipo_accion;
          const isLast = i === acciones.length - 1;
          return (
            <li key={a.id} className="relative pl-4">
              <span
                className="absolute left-0 top-2 w-2 h-2 rounded-full"
                style={{
                  background: "var(--text-primary)",
                  boxShadow: "0 0 0 3px var(--bg-elevated)",
                }}
              />
              {!isLast && (
                <span
                  className="absolute left-[3px] top-3 bottom-[-12px] w-px"
                  style={{ background: "var(--border-subtle)" }}
                />
              )}
              <div className="text-body-medium">{label}</div>
              <div className="text-caption text-text-tertiary num-tabular">
                {fmtFecha(a.created_at)}
              </div>
              {a.metadata?.comentario && (
                <p className="text-caption text-text-secondary mt-1">
                  💬 {a.metadata.comentario}
                </p>
              )}
              {a.metadata?.cambios && (
                <div className="text-caption text-text-secondary mt-1">
                  {Object.keys(a.metadata.cambios).join(", ")}
                </div>
              )}
              {a.metadata?.aprobado_por && (
                <p className="text-caption text-text-tertiary mt-1">
                  por {a.metadata.aprobado_por}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
