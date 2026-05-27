"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Trash2,
  Sparkles,
  RefreshCcw,
  User as UserIcon,
  Send,
} from "lucide-react";
import ConfirmAccionModal from "@/components/ui/ConfirmAccionModal";
import type { SubTipoTicket, TipoTicket } from "@/lib/jira/format";

type Ticket = {
  id: string;
  jira_key: string;
  jira_url: string;
  titulo: string;
  descripcion_md: string | null;
  tipo: TipoTicket;
  sub_tipo: SubTipoTicket | null;
  prioridad: string;
  horas_estimadas: number | null;
  asignado_jira_id: string;
  asignado_nombre: string;
  asignado_correo: string | null;
  proyecto_jira_key: string;
  proyecto_jira_nombre: string;
  carril: string | null;
  cotizacion_ref: string | null;
};

type JiraUser = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
};
type JiraStatus = { id: string; name: string };

const TIPOS: { id: TipoTicket; label: string }[] = [
  { id: "estimacion", label: "Estimación" },
  { id: "desarrollo", label: "Desarrollo" },
  { id: "soporte", label: "Soporte" },
  { id: "investigacion", label: "Investigación" },
];

const SUBTIPOS_POR_TIPO: Record<TipoTicket, SubTipoTicket[]> = {
  estimacion: ["task"],
  desarrollo: ["task", "historia"],
  soporte: ["task", "bug"],
  investigacion: ["task"],
};

const SUBTIPO_LABEL: Record<SubTipoTicket, string> = {
  task: "Tarea",
  historia: "Historia",
  bug: "Bug",
};

const PRIORIDADES = [
  { id: "highest", label: "Más alta", color: "#DC2626" },
  { id: "high", label: "Alta", color: "#F59E0B" },
  { id: "medium", label: "Media", color: "#3B82F6" },
  { id: "low", label: "Baja", color: "#16A34A" },
  { id: "lowest", label: "Más baja", color: "#6B7280" },
];

export default function TicketEditor({ ticket }: { ticket: Ticket }) {
  const router = useRouter();

  // Limpieza: quitar prefijo del título para mostrarlo "corto" en el input
  const tituloSinPrefijo = ticket.titulo.replace(
    /^\s*(Estimación|Soporte|Investigación)\s*:\s*/i,
    ""
  );

  const [form, setForm] = useState({
    titulo: tituloSinPrefijo,
    descripcion_md: ticket.descripcion_md ?? "",
    tipo: ticket.tipo,
    sub_tipo: ticket.sub_tipo,
    prioridad: ticket.prioridad,
    horas_estimadas:
      ticket.horas_estimadas != null ? String(ticket.horas_estimadas) : "",
    asignado_jira_id: ticket.asignado_jira_id,
    asignado_nombre: ticket.asignado_nombre,
    asignado_correo: ticket.asignado_correo,
    carril: ticket.carril,
  });

  const [usuarios, setUsuarios] = useState<JiraUser[] | null>(null);
  const [carriles, setCarriles] = useState<JiraStatus[] | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [formateandoIA, setFormateandoIA] = useState(false);
  const [sugiriendoHoras, setSugiriendoHoras] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "warn" | "error"; texto: string } | null>(
    null
  );
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  const reenviarDM = async () => {
    setReenviando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/reenviar-dm`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setMensaje({
          tipo: "error",
          texto: json.error || "No se pudo reenviar el DM",
        });
        return;
      }
      setMensaje({
        tipo: "ok",
        texto: `DM reenviado a ${json.enviado_a ?? "el asignado"}`,
      });
      setTimeout(() => setMensaje(null), 3000);
    } catch {
      setMensaje({ tipo: "error", texto: "Error de red" });
    } finally {
      setReenviando(false);
    }
  };

  const cargarUsuarios = (force = false) => {
    fetch(`/api/tickets/jira-meta${force ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((j) => {
        const us: JiraUser[] = j.usuarios ?? [];
        setUsuarios(us);
        // Refrescar el correo del asignado actual desde JIRA: si lo hicieron
        // visible después de crear el ticket, ahora sí lo capturamos.
        setForm((f) => {
          const actual = us.find((u) => u.accountId === f.asignado_jira_id);
          if (
            actual?.emailAddress &&
            actual.emailAddress !== f.asignado_correo
          ) {
            return { ...f, asignado_correo: actual.emailAddress };
          }
          return f;
        });
      })
      .catch(() => setUsuarios([]));
  };

  // Cargar usuarios + carriles del proyecto (para asignar / cambiar carril)
  useEffect(() => {
    cargarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [refrescando, setRefrescando] = useState(false);
  const refrescarUsuarios = async () => {
    setRefrescando(true);
    setMensaje(null);
    cargarUsuarios(true);
    // Damos un par de segundos para que la respuesta llegue y feedback al usuario
    setTimeout(() => {
      setRefrescando(false);
      setMensaje({
        tipo: "ok",
        texto:
          "Usuarios refrescados desde JIRA. Si el correo apareció, el botón Reenviar ya debería estar activo.",
      });
      setTimeout(() => setMensaje(null), 4000);
    }, 1500);
  };

  useEffect(() => {
    fetch(
      `/api/tickets/jira-carriles?proyecto=${ticket.proyecto_jira_key}`
    )
      .then((r) => r.json())
      .then((j) => setCarriles(j.carriles ?? []))
      .catch(() => setCarriles([]));
  }, [ticket.proyecto_jira_key]);

  const subTiposDisponibles = SUBTIPOS_POR_TIPO[form.tipo];

  const dirty = useMemo(() => {
    return (
      form.titulo !== tituloSinPrefijo ||
      form.descripcion_md !== (ticket.descripcion_md ?? "") ||
      form.tipo !== ticket.tipo ||
      form.sub_tipo !== ticket.sub_tipo ||
      form.prioridad !== ticket.prioridad ||
      form.horas_estimadas !==
        (ticket.horas_estimadas != null ? String(ticket.horas_estimadas) : "") ||
      form.asignado_jira_id !== ticket.asignado_jira_id ||
      form.carril !== ticket.carril
    );
  }, [form, ticket, tituloSinPrefijo]);

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const horas = form.horas_estimadas.trim()
        ? Number(form.horas_estimadas)
        : null;
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo.trim(),
          descripcion_md: form.descripcion_md.trim() || null,
          tipo: form.tipo,
          sub_tipo: form.sub_tipo,
          prioridad: form.prioridad,
          horas_estimadas:
            Number.isFinite(horas) && (horas as number) > 0 ? horas : null,
          asignado_jira_id: form.asignado_jira_id,
          asignado_nombre: form.asignado_nombre,
          asignado_correo: form.asignado_correo,
          carril: form.carril,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: json.error || "No se pudo guardar" });
        return;
      }
      if (json.warnings && json.warnings.length > 0) {
        setMensaje({ tipo: "warn", texto: json.warnings.join(" · ") });
      } else {
        setMensaje({ tipo: "ok", texto: "Guardado y sincronizado con JIRA" });
        setTimeout(() => setMensaje(null), 2500);
      }
      router.refresh();
    } catch {
      setMensaje({ tipo: "error", texto: "Error de red" });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async ({ checkboxMarcado }: { checkboxMarcado: boolean }) => {
    const url = `/api/tickets/${ticket.id}${
      checkboxMarcado ? "?borrar_jira=1" : ""
    }`;
    const res = await fetch(url, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "No se pudo eliminar");
    router.replace("/panel/tickets");
  };

  // ── IA ──
  const formatearConIA = async () => {
    setMensaje(null);
    const texto = form.descripcion_md.trim();
    if (!texto && !form.titulo.trim()) {
      setMensaje({
        tipo: "error",
        texto: "Escribe algo en título o descripción primero.",
      });
      return;
    }
    setFormateandoIA(true);
    try {
      const combinado = [form.titulo.trim(), texto].filter(Boolean).join("\n\n");
      const res = await fetch("/api/tickets/formatear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: combinado,
          tipo: form.tipo,
          sub_tipo: form.sub_tipo,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: j.error || "Error IA" });
        return;
      }
      setForm((f) => ({
        ...f,
        titulo: j.titulo_corto || f.titulo,
        descripcion_md: j.descripcion_md,
      }));
    } catch {
      setMensaje({ tipo: "error", texto: "Error de red" });
    } finally {
      setFormateandoIA(false);
    }
  };

  const sugerirHoras = async () => {
    setMensaje(null);
    if (!form.descripcion_md.trim()) {
      setMensaje({
        tipo: "error",
        texto: "Necesito descripción para sugerir horas.",
      });
      return;
    }
    setSugiriendoHoras(true);
    try {
      const res = await fetch("/api/tickets/recomendar-horas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion_md: form.descripcion_md,
          tipo: form.tipo,
          sub_tipo: form.sub_tipo,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: j.error || "Error IA" });
        return;
      }
      setForm((f) => ({ ...f, horas_estimadas: String(j.horas) }));
      setMensaje({
        tipo: "ok",
        texto: `IA sugiere ${j.horas}h: ${j.justificacion}`,
      });
    } catch {
      setMensaje({ tipo: "error", texto: "Error de red" });
    } finally {
      setSugiriendoHoras(false);
    }
  };

  return (
    <>
      {/* Asignado + acciones — siempre visible arriba */}
      <section
        className="rounded-[12px] overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <UserIcon size={16} strokeWidth={1.75} className="text-text-secondary shrink-0" />
            <h2 className="text-heading-2">Asignado</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={refrescarUsuarios}
              disabled={refrescando}
              className="btn-ghost btn-sm"
              title="Vuelve a consultar usuarios de JIRA (forzar cache fresca)"
            >
              <RefreshCcw size={14} strokeWidth={1.75} />
              <span>{refrescando ? "Refrescando…" : "Refrescar"}</span>
            </button>
            <button
              type="button"
              onClick={reenviarDM}
              disabled={reenviando || !form.asignado_correo}
              className="btn-primary btn-sm"
              title={
                form.asignado_correo
                  ? "Reenvía el DM al asignado actual con los datos vigentes"
                  : "El asignado no tiene correo registrado en JIRA"
              }
            >
              <Send size={14} strokeWidth={1.75} />
              <span>{reenviando ? "Reenviando…" : "Reenviar a programador"}</span>
            </button>
          </div>
        </div>
        <div className="p-5 space-y-2">
          {usuarios === null ? (
            <p className="text-caption text-text-tertiary">Cargando usuarios…</p>
          ) : (
            <select
              className="input"
              value={form.asignado_jira_id}
              onChange={(e) => {
                const u = usuarios.find((x) => x.accountId === e.target.value);
                if (u) {
                  setForm((f) => ({
                    ...f,
                    asignado_jira_id: u.accountId,
                    asignado_nombre: u.displayName,
                    asignado_correo: u.emailAddress ?? null,
                  }));
                }
              }}
            >
              {usuarios.map((u) => (
                <option key={u.accountId} value={u.accountId}>
                  {u.displayName}
                  {u.emailAddress ? ` · ${u.emailAddress}` : ""}
                </option>
              ))}
            </select>
          )}
          <p className="text-caption text-text-tertiary">
            Cambiarlo reasigna el ticket en JIRA al guardar.
            {!form.asignado_correo && (
              <>
                {" "}
                <span style={{ color: "var(--state-warning)" }}>
                  Este asignado no tiene correo público en JIRA — no se le puede
                  mandar DM hasta que lo configure.
                </span>
              </>
            )}
          </p>
          {mensaje && (
            <p
              className="text-caption"
              style={{
                color:
                  mensaje.tipo === "ok"
                    ? "var(--state-success)"
                    : mensaje.tipo === "warn"
                    ? "var(--state-warning)"
                    : "var(--state-error)",
              }}
            >
              {mensaje.tipo === "ok" ? "✓" : "⚠"} {mensaje.texto}
            </p>
          )}
        </div>
      </section>

      <section className="card space-y-5">
        {/* Tipo + sub-tipo + carril */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="field-label">Tipo</label>
            <select
              className="input"
              value={form.tipo}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tipo: e.target.value as TipoTicket,
                  sub_tipo: SUBTIPOS_POR_TIPO[e.target.value as TipoTicket][0],
                }))
              }
            >
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Sub-tipo</label>
            <select
              className="input"
              value={form.sub_tipo ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sub_tipo: (e.target.value || null) as SubTipoTicket | null,
                }))
              }
              disabled={subTiposDisponibles.length <= 1}
            >
              {subTiposDisponibles.map((s) => (
                <option key={s} value={s}>
                  {SUBTIPO_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Carril</label>
            <select
              className="input"
              value={form.carril ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, carril: e.target.value || null }))
              }
            >
              <option value="">— sin cambiar —</option>
              {(carriles ?? []).map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Título */}
        <div>
          <label className="field-label">Título corto</label>
          <input
            className="input"
            value={form.titulo}
            onChange={(e) =>
              setForm((f) => ({ ...f, titulo: e.target.value }))
            }
          />
          <span className="field-hint">
            Al guardar se aplica automáticamente el prefijo del tipo
            (ej. &quot;Soporte: &quot;).
          </span>
        </div>

        {/* Descripción */}
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="field-label">Descripción (markdown)</label>
            <button
              type="button"
              onClick={formatearConIA}
              disabled={formateandoIA}
              className="btn-secondary btn-sm"
            >
              <Sparkles size={14} strokeWidth={1.75} />
              <span>{formateandoIA ? "Formateando…" : "Formatear con IA"}</span>
            </button>
          </div>
          <textarea
            className="textarea min-h-[260px] mt-2"
            rows={12}
            value={form.descripcion_md}
            onChange={(e) =>
              setForm((f) => ({ ...f, descripcion_md: e.target.value }))
            }
          />
        </div>

        {/* Prioridad + horas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Prioridad</label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {PRIORIDADES.map((p) => {
                const activo = form.prioridad === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, prioridad: p.id }))
                    }
                    className="p-2 rounded-[10px] text-center"
                    style={{
                      background: activo
                        ? "var(--bg-overlay)"
                        : "var(--bg-surface)",
                      border: `2px solid ${
                        activo ? p.color : "var(--border-subtle)"
                      }`,
                    }}
                  >
                    <div
                      className="num-tabular"
                      style={{
                        color: p.color,
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {p.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="field-label">Horas estimadas</label>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <input
                className="input num-tabular text-center"
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                value={form.horas_estimadas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, horas_estimadas: e.target.value }))
                }
                placeholder="—"
                style={{ maxWidth: 120 }}
              />
              <span className="text-body text-text-secondary">horas</span>
              <button
                type="button"
                onClick={sugerirHoras}
                disabled={sugiriendoHoras}
                className="btn-secondary btn-sm ml-auto"
              >
                <Sparkles size={14} strokeWidth={1.75} />
                <span>{sugiriendoHoras ? "…" : "Sugerir con IA"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mensajes */}
        {mensaje && (
          <p
            className="text-caption"
            style={{
              color:
                mensaje.tipo === "ok"
                  ? "var(--state-success)"
                  : mensaje.tipo === "warn"
                  ? "var(--state-warning)"
                  : "var(--state-error)",
            }}
          >
            {mensaje.tipo === "ok" ? "✓" : "⚠"} {mensaje.texto}
          </p>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="btn-ghost btn-sm"
            >
              <RefreshCcw size={14} strokeWidth={1.75} />
              <span>Recargar</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmEliminar(true)}
              className="btn-ghost"
              style={{ color: "var(--state-error)" }}
            >
              <Trash2 size={16} strokeWidth={1.75} />
              <span>Eliminar</span>
            </button>
          </div>
          <button
            type="button"
            onClick={guardar}
            disabled={!dirty || guardando}
            className="btn-primary"
          >
            <Save size={16} strokeWidth={1.75} />
            <span>
              {guardando ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}
            </span>
          </button>
        </div>
      </section>

      <ConfirmAccionModal
        open={confirmEliminar}
        onClose={() => setConfirmEliminar(false)}
        onConfirm={eliminar}
        titulo="Eliminar ticket"
        descripcion={
          <>
            Esta acción es <strong>irreversible</strong> del lado del panel. Si
            marcas la casilla, también se borrará el ticket de JIRA. Si no, se
            queda en JIRA tal cual y solo se quita del panel.
          </>
        }
        palabraClave="eliminar"
        textoBoton="Eliminar definitivamente"
        peligroso
        checkbox={{
          label: "También borrar el ticket en JIRA",
          descripcion: `Se elimina el ticket ${ticket.jira_key} de forma permanente en JIRA.`,
        }}
      />
    </>
  );
}
