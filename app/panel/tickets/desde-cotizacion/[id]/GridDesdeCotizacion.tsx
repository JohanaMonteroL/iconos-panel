"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Sparkles,
  Search,
  User as UserIcon,
  FolderKanban,
  Tag,
  Flag,
  Check,
} from "lucide-react";
import type { SubTipoTicket, TipoTicket } from "@/lib/jira/format";

type JiraProject = { id: string; key: string; name: string };
type JiraUser = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
};
type JiraStatus = { id: string; name: string };

type TareaForm = {
  id: string; // tarea_estimacion_ref
  titulo: string;
  descripcionMd: string;
  horasEstimadas: string;
  // resultado tras crear
  resultado: null | { ok: boolean; key?: string; url?: string; error?: string };
};

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

const PRIORIDADES = [
  { id: "highest", label: "Más alta", color: "#DC2626" },
  { id: "high", label: "Alta", color: "#F59E0B" },
  { id: "medium", label: "Media", color: "#3B82F6" },
  { id: "low", label: "Baja", color: "#16A34A" },
  { id: "lowest", label: "Más baja", color: "#6B7280" },
];

export default function GridDesdeCotizacion({
  cotizacionId,
}: {
  cotizacionId: string;
}) {
  const router = useRouter();

  // Datos generales que aplican a TODOS los tickets
  const [proyecto, setProyecto] = useState<JiraProject | null>(null);
  const [asignado, setAsignado] = useState<JiraUser | null>(null);
  const [tipo, setTipo] = useState<TipoTicket>("desarrollo");
  const [subTipo, setSubTipo] = useState<SubTipoTicket | null>("task");
  const [carril, setCarril] = useState<string | null>(null);
  const [prioridad, setPrioridad] = useState<string>("medium");

  // Datos por tarea (independientes)
  const [tareas, setTareas] = useState<TareaForm[]>([]);
  const [cotNombre, setCotNombre] = useState<string>("");

  // Meta JIRA
  const [meta, setMeta] = useState<{
    proyectos: JiraProject[];
    usuarios: JiraUser[];
  } | null>(null);
  const [carriles, setCarriles] = useState<JiraStatus[]>([]);
  const [sprintActivo, setSprintActivo] = useState<{ id: number; name: string } | null>(
    null
  );
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [filtroProyectos, setFiltroProyectos] = useState("");

  // Estado de envío
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos de la cotización
  useEffect(() => {
    fetch(`/api/cotizaciones/${cotizacionId}/datos-tickets`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.por_tarea) {
          setError("No se pudieron cargar las tareas de la cotización.");
          return;
        }
        setCotNombre(j.cotizacion.nombre);
        setTareas(
          j.por_tarea.map((t: any) => ({
            id: t.tarea_id,
            titulo: t.titulo,
            descripcionMd: t.descripcion_md,
            horasEstimadas:
              t.horas_estimadas != null ? String(t.horas_estimadas) : "",
            resultado: null,
          }))
        );
      })
      .catch(() => setError("Error de red cargando la cotización"));
  }, [cotizacionId]);

  // Cargar meta JIRA
  useEffect(() => {
    fetch("/api/tickets/jira-meta")
      .then((r) => r.json())
      .then((j) =>
        setMeta({
          proyectos: j.proyectos ?? [],
          usuarios: j.usuarios ?? [],
        })
      )
      .catch(() => setMeta({ proyectos: [], usuarios: [] }));
  }, []);

  // Cuando cambia proyecto → cargar carriles + sprint
  useEffect(() => {
    if (!proyecto) return;
    setCarriles([]);
    setCarril(null);
    setSprintActivo(null);
    fetch(`/api/tickets/jira-carriles?proyecto=${proyecto.key}`)
      .then((r) => r.json())
      .then((j) => {
        setCarriles(j.carriles ?? []);
        if (j.sprintActivo && typeof j.sprintActivo.id === "number") {
          setSprintActivo({ id: j.sprintActivo.id, name: j.sprintActivo.name });
        }
      });
  }, [proyecto]);

  const proyectosFiltrados = useMemo(() => {
    if (!meta) return [];
    const term = filtroProyectos.trim().toLowerCase();
    if (!term) return meta.proyectos;
    return meta.proyectos.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.key.toLowerCase().includes(term)
    );
  }, [meta, filtroProyectos]);

  const usuariosFiltrados = useMemo(() => {
    if (!meta) return [];
    const term = filtroUsuarios.trim().toLowerCase();
    if (!term) return meta.usuarios;
    return meta.usuarios.filter(
      (u) =>
        u.displayName.toLowerCase().includes(term) ||
        u.emailAddress?.toLowerCase().includes(term)
    );
  }, [meta, filtroUsuarios]);

  const subTiposDisponibles = SUBTIPOS_POR_TIPO[tipo];

  const puedeCrear = useMemo(() => {
    if (!proyecto || !asignado || !prioridad) return false;
    if (tareas.length === 0) return false;
    return tareas.every((t) => t.titulo.trim().length > 0);
  }, [proyecto, asignado, prioridad, tareas]);

  const totalPendientes = tareas.filter((t) => !t.resultado?.ok).length;

  const actualizarTarea = (i: number, patch: Partial<TareaForm>) => {
    setTareas((arr) => arr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };

  const crearTodos = async () => {
    if (!proyecto || !asignado) return;
    setError(null);
    setCreando(true);

    // Recorre las tareas pendientes secuencialmente para no spammear JIRA.
    for (let i = 0; i < tareas.length; i++) {
      const t = tareas[i];
      if (t.resultado?.ok) continue; // ya creado en intento previo

      try {
        const horas = t.horasEstimadas.trim()
          ? Number(t.horasEstimadas)
          : null;
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: t.titulo.trim(),
            descripcion_md: t.descripcionMd.trim() || null,
            tipo,
            sub_tipo: subTipo,
            prioridad,
            horas_estimadas:
              Number.isFinite(horas) && (horas as number) > 0 ? horas : null,
            proyecto_jira_key: proyecto.key,
            proyecto_jira_nombre: proyecto.name,
            asignado_jira_id: asignado.accountId,
            asignado_nombre: asignado.displayName,
            asignado_correo: asignado.emailAddress ?? null,
            carril,
            cotizacion_ref: cotizacionId,
            tarea_estimacion_ref: t.id,
          }),
        });
        const j = await res.json();
        if (!res.ok && res.status !== 207) {
          actualizarTarea(i, {
            resultado: { ok: false, error: j.error || "Error" },
          });
        } else {
          actualizarTarea(i, {
            resultado: {
              ok: true,
              key: j.jira_key,
              url: j.jira_url,
            },
          });
        }
      } catch {
        actualizarTarea(i, {
          resultado: { ok: false, error: "Error de red" },
        });
      }
    }

    setCreando(false);
    router.refresh();
  };

  if (!meta) {
    return <div className="card text-body text-text-secondary">Cargando JIRA…</div>;
  }
  if (tareas.length === 0 && !error) {
    return (
      <div className="card text-body text-text-secondary">Cargando tareas…</div>
    );
  }
  if (error && tareas.length === 0) {
    return (
      <div className="card" style={{ borderColor: "var(--state-error)" }}>
        <p className="text-body" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cotización origen */}
      <div
        className="card card-tight"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--state-info)",
        }}
      >
        <div className="text-body-medium" style={{ color: "var(--state-info)" }}>
          {tareas.length} ticket{tareas.length === 1 ? "" : "s"} a generar
        </div>
        <div className="text-caption text-text-secondary mt-1">
          Desde la cotización <strong>{cotNombre}</strong>. Cada tarea genera
          un ticket independiente en JIRA con su propia descripción y horas.
        </div>
      </div>

      {/* Datos globales */}
      <section className="card space-y-5">
        <h2 className="text-heading-2">Datos para TODOS los tickets</h2>

        {/* Asignado */}
        <div>
          <label className="field-label">
            <UserIcon size={14} strokeWidth={1.75} className="inline mr-1" />
            Asignado *
          </label>
          <div
            className="input flex items-center gap-2 mb-2"
            style={{ padding: "0 12px" }}
          >
            <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
            <input
              className="flex-1 bg-transparent outline-none border-0"
              placeholder="Buscar…"
              value={filtroUsuarios}
              onChange={(e) => setFiltroUsuarios(e.target.value)}
            />
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
            {usuariosFiltrados.map((u) => {
              const activo = asignado?.accountId === u.accountId;
              return (
                <li key={u.accountId}>
                  <button
                    type="button"
                    onClick={() => setAsignado(u)}
                    className="w-full text-left p-2 rounded-[10px] text-body flex items-center justify-between gap-2"
                    style={{
                      background: activo
                        ? "var(--bg-overlay)"
                        : "var(--bg-surface)",
                      border: `1px solid ${
                        activo ? "#0066FF" : "var(--border-subtle)"
                      }`,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-body-medium">
                        {u.displayName}
                      </div>
                      {u.emailAddress && (
                        <div className="text-caption text-text-tertiary truncate">
                          {u.emailAddress}
                        </div>
                      )}
                    </div>
                    {activo && (
                      <Check
                        size={14}
                        strokeWidth={1.75}
                        style={{ color: "#0066FF" }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Proyecto */}
        <div>
          <label className="field-label">
            <FolderKanban size={14} strokeWidth={1.75} className="inline mr-1" />
            Proyecto JIRA *
          </label>
          <div
            className="input flex items-center gap-2 mb-2"
            style={{ padding: "0 12px" }}
          >
            <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
            <input
              className="flex-1 bg-transparent outline-none border-0"
              placeholder="Buscar proyecto…"
              value={filtroProyectos}
              onChange={(e) => setFiltroProyectos(e.target.value)}
            />
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
            {proyectosFiltrados.map((p) => {
              const activo = proyecto?.key === p.key;
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => setProyecto(p)}
                    className="w-full text-left p-2 rounded-[10px] text-body flex items-center justify-between"
                    style={{
                      background: activo
                        ? "var(--bg-overlay)"
                        : "var(--bg-surface)",
                      border: `1px solid ${
                        activo ? "#0066FF" : "var(--border-subtle)"
                      }`,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-body-medium">{p.name}</div>
                      <div className="text-caption text-text-tertiary num-tabular">
                        {p.key}
                      </div>
                    </div>
                    {activo && (
                      <Check
                        size={14}
                        strokeWidth={1.75}
                        style={{ color: "#0066FF" }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {proyecto && (
            <div
              className="text-caption mt-2 p-2 rounded-[8px]"
              style={{
                background: "var(--bg-surface)",
                border: `1px solid ${
                  sprintActivo ? "var(--border-subtle)" : "var(--state-warning)"
                }`,
              }}
            >
              {sprintActivo ? (
                <>
                  Sprint activo: <strong>{sprintActivo.name}</strong>
                </>
              ) : (
                <span style={{ color: "var(--state-warning)" }}>
                  ⚠ Sin sprint activo — los tickets quedan en backlog.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tipo + sub-tipo + carril + prioridad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="field-label">
              <Tag size={14} strokeWidth={1.75} className="inline mr-1" />
              Tipo *
            </label>
            <select
              className="input"
              value={tipo}
              onChange={(e) => {
                const t = e.target.value as TipoTicket;
                setTipo(t);
                setSubTipo(SUBTIPOS_POR_TIPO[t][0]);
              }}
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
              value={subTipo ?? ""}
              onChange={(e) => setSubTipo(e.target.value as SubTipoTicket)}
              disabled={subTiposDisponibles.length <= 1}
            >
              {subTiposDisponibles.map((s) => (
                <option key={s} value={s}>
                  {s === "task" ? "Tarea" : s === "historia" ? "Historia" : "Bug"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Carril inicial</label>
            <select
              className="input"
              value={carril ?? ""}
              onChange={(e) => setCarril(e.target.value || null)}
              disabled={!proyecto || carriles.length === 0}
            >
              <option value="">— inicial por defecto —</option>
              {carriles.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">
              <Flag size={14} strokeWidth={1.75} className="inline mr-1" />
              Prioridad *
            </label>
            <select
              className="input"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
            >
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Lista de tareas */}
      <section className="space-y-3">
        <h2 className="text-heading-2">Tareas ({tareas.length})</h2>
        <ul className="space-y-3">
          {tareas.map((t, i) => (
            <li
              key={t.id}
              className="rounded-[12px] border overflow-hidden"
              style={{
                background: t.resultado?.ok
                  ? "rgba(34,197,94,0.06)"
                  : "var(--bg-elevated)",
                borderColor: t.resultado?.ok
                  ? "var(--state-success)"
                  : t.resultado?.error
                  ? "var(--state-error)"
                  : "var(--border-subtle)",
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-3 border-b"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="text-overline text-text-tertiary">
                  Ticket {i + 1}
                </div>
                {t.resultado?.ok ? (
                  <a
                    href={t.resultado.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-caption num-tabular"
                    style={{ color: "var(--state-success)" }}
                  >
                    ✓ Creado: {t.resultado.key}
                  </a>
                ) : t.resultado?.error ? (
                  <span
                    className="text-caption"
                    style={{ color: "var(--state-error)" }}
                  >
                    ⚠ {t.resultado.error}
                  </span>
                ) : null}
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="field-label">Título</label>
                  <input
                    className="input"
                    value={t.titulo}
                    disabled={t.resultado?.ok}
                    onChange={(e) =>
                      actualizarTarea(i, { titulo: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="field-label">Descripción (markdown)</label>
                  <textarea
                    className="textarea min-h-[140px] mt-2"
                    rows={6}
                    value={t.descripcionMd}
                    disabled={t.resultado?.ok}
                    onChange={(e) =>
                      actualizarTarea(i, { descripcionMd: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="field-label" style={{ marginBottom: 0 }}>
                    Horas estimadas
                  </label>
                  <input
                    className="input num-tabular text-center"
                    type="number"
                    min={0}
                    step={0.5}
                    inputMode="decimal"
                    value={t.horasEstimadas}
                    disabled={t.resultado?.ok}
                    onChange={(e) =>
                      actualizarTarea(i, { horasEstimadas: e.target.value })
                    }
                    style={{ maxWidth: 100 }}
                  />
                  <span className="text-caption text-text-secondary">
                    horas
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Acciones */}
      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}

      <div
        className="sticky bottom-4 pt-4 flex items-center justify-between gap-3 flex-wrap"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-base)",
        }}
      >
        <div className="text-caption text-text-tertiary">
          {tareas.length - totalPendientes} de {tareas.length} creados
        </div>
        <button
          type="button"
          onClick={crearTodos}
          disabled={!puedeCrear || creando || totalPendientes === 0}
          className="btn-primary"
        >
          <Send size={16} strokeWidth={1.75} />
          <span>
            {creando
              ? `Creando ${totalPendientes} ticket${totalPendientes === 1 ? "" : "s"}…`
              : totalPendientes === 0
              ? "Todos creados"
              : `Crear ${totalPendientes} ticket${totalPendientes === 1 ? "" : "s"}`}
          </span>
        </button>
      </div>

      {totalPendientes === 0 && tareas.length > 0 && (
        <div
          className="card text-center space-y-3"
          style={{ background: "rgba(34,197,94,0.06)", borderColor: "var(--state-success)" }}
        >
          <p className="text-body-medium" style={{ color: "var(--state-success)" }}>
            ✓ Todos los tickets se crearon en JIRA
          </p>
          <a href="/panel/tickets" className="btn-primary inline-flex">
            <Sparkles size={16} strokeWidth={1.75} />
            <span>Ver todos los tickets</span>
          </a>
        </div>
      )}
    </div>
  );
}
