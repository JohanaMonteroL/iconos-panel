"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User as UserIcon,
  FolderKanban,
  Tag,
  FileText,
  Flag,
  Clock,
  Check,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Send,
  Sparkles,
  Paperclip,
  Trash2,
} from "lucide-react";
import type { SubTipoTicket, TipoTicket } from "@/lib/tickets/format";

type ClickUpProyecto = { id: string; name: string };
type ClickUpUsuario = { id: string; username: string; email?: string };

const TIPOS: { id: TipoTicket; label: string; desc: string }[] = [
  { id: "estimacion", label: "Estimación", desc: "Cotización a estimar" },
  { id: "desarrollo", label: "Desarrollo", desc: "Trabajo de programación nuevo" },
  { id: "soporte", label: "Soporte", desc: "Cambio menor o bug" },
  { id: "investigacion", label: "Investigación", desc: "Spike / exploración técnica" },
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

const PRIORIDADES_UI = [
  { id: "highest", label: "Más alta", color: "#DC2626" },
  { id: "high", label: "Alta", color: "#F59E0B" },
  { id: "medium", label: "Media", color: "#3B82F6" },
  { id: "low", label: "Baja", color: "#16A34A" },
  { id: "lowest", label: "Más baja", color: "#6B7280" },
];

type Form = {
  asignado: ClickUpUsuario | null;
  proyecto: string; // nombre de la Lista (existente o nueva)
  tipo: TipoTicket | null;
  subTipo: SubTipoTicket | null;
  carril: string | null;
  titulo: string;
  descripcionMd: string;
  prioridad: string | null;
  horasEstimadas: string; // input controlado, parseamos al enviar
  adjuntos: File[];
  justificacionHoras: string | null;
};

const PASOS = ["Para quién", "Proyecto", "Tipo", "Descripción", "Prioridad", "Horas", "Resumen"];

export default function WizardTicket() {
  const router = useRouter();
  const params = useSearchParams();
  const desdeCotizacion = params.get("desde_cotizacion");
  const [paso, setPaso] = useState(0);
  const [meta, setMeta] = useState<{
    proyectos: ClickUpProyecto[];
    usuarios: ClickUpUsuario[];
  } | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [carriles, setCarriles] = useState<string[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cotizacionData, setCotizacionData] = useState<{
    cotizacion: { id: string; nombre: string };
  } | null>(null);

  const [form, setForm] = useState<Form>({
    asignado: null,
    proyecto: "",
    tipo: null,
    subTipo: null,
    carril: null,
    titulo: "",
    descripcionMd: "",
    prioridad: null,
    horasEstimadas: "",
    adjuntos: [],
    justificacionHoras: null,
  });

  // Cargar pre-llenado desde una cotización si se pasó por query string.
  useEffect(() => {
    if (!desdeCotizacion) return;
    fetch(`/api/cotizaciones/${desdeCotizacion}/datos-tickets`)
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((j) => {
        if (!j || !j.completo) return;
        setCotizacionData({ cotizacion: j.cotizacion });
        setForm((f) => ({
          ...f,
          tipo: "desarrollo",
          subTipo: "task",
          titulo: j.completo.titulo,
          descripcionMd: j.completo.descripcion_md,
          horasEstimadas:
            j.completo.horas_estimadas != null
              ? String(j.completo.horas_estimadas)
              : "",
        }));
      })
      .catch(() => {});
  }, [desdeCotizacion]);

  // Cargar meta de ClickUp al montar
  useEffect(() => {
    fetch("/api/tickets/clickup-meta")
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setMetaError(j.error || "No se pudo cargar ClickUp");
          return null;
        }
        return r.json();
      })
      .then((j) => j && setMeta(j))
      .catch(() => setMetaError("Error de red consultando ClickUp"));
  }, []);

  const listaSeleccionada = useMemo(() => {
    if (!meta || !form.proyecto.trim()) return null;
    const term = form.proyecto.trim().toLowerCase();
    return meta.proyectos.find((p) => p.name.trim().toLowerCase() === term) ?? null;
  }, [meta, form.proyecto]);

  // Cargar carriles cuando el proyecto elegido ya existe en ClickUp.
  useEffect(() => {
    if (!listaSeleccionada) {
      setCarriles(null);
      return;
    }
    setCarriles(null);
    fetch(`/api/tickets/clickup-carriles?lista=${listaSeleccionada.id}`)
      .then((r) => r.json())
      .then((j) => setCarriles(j.carriles ?? []))
      .catch(() => setCarriles([]));
  }, [listaSeleccionada]);

  const subTiposDisponibles = form.tipo ? SUBTIPOS_POR_TIPO[form.tipo] : [];

  // ── Validación por paso (controla el botón Siguiente) ─────────────────
  const puedeAvanzar = useMemo(() => {
    switch (paso) {
      case 0:
        return !!form.asignado;
      case 1:
        return form.proyecto.trim().length > 0;
      case 2:
        return !!form.tipo && (!subTiposDisponibles.length || !!form.subTipo);
      case 3:
        return form.titulo.trim().length > 0;
      case 4:
        return !!form.prioridad;
      case 5:
        return true; // horas son opcionales
      case 6:
        return true;
      default:
        return false;
    }
  }, [paso, form, subTiposDisponibles.length]);

  // ── Envío ─────────────────────────────────────────────────────────────
  const crear = async () => {
    if (!form.asignado || !form.proyecto.trim() || !form.tipo || !form.prioridad) return;
    setEnviando(true);
    setError(null);
    try {
      const horas = form.horasEstimadas.trim()
        ? Number(form.horasEstimadas)
        : null;
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo.trim(),
          descripcion_md: form.descripcionMd.trim() || null,
          tipo: form.tipo,
          sub_tipo: form.subTipo,
          prioridad: form.prioridad,
          horas_estimadas: Number.isFinite(horas) && (horas as number) > 0 ? horas : null,
          proyecto_nombre: form.proyecto.trim(),
          asignado_clickup_id: form.asignado.id,
          asignado_nombre: form.asignado.username,
          asignado_correo: form.asignado.email ?? null,
          carril: form.carril,
          cotizacion_ref: cotizacionData?.cotizacion.id ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 207) {
        setError(json.error || "Error al crear el ticket");
        return;
      }

      // Subir adjuntos si los hay (best-effort, no bloquea el éxito).
      if (form.adjuntos.length > 0 && json.id) {
        try {
          const fd = new FormData();
          form.adjuntos.forEach((f) => fd.append("file", f));
          const upRes = await fetch(`/api/tickets/${json.id}/adjuntos`, {
            method: "POST",
            body: fd,
          });
          const upJson = await upRes.json().catch(() => ({}));
          if (upJson.rechazados && upJson.rechazados.length > 0) {
            console.warn("[tickets] adjuntos rechazados:", upJson.rechazados);
          }
        } catch (e) {
          console.warn("[tickets] error subiendo adjuntos:", e);
        }
      }

      // Éxito → regresa a la cotización de origen, o al inicio si fue standalone.
      router.push(
        cotizacionData ? `/panel/cotizaciones/${cotizacionData.cotizacion.id}` : "/panel"
      );
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setEnviando(false);
    }
  };

  if (metaError) {
    return (
      <div className="card" style={{ borderColor: "var(--state-warning)" }}>
        <p className="text-body-medium mb-1">ClickUp no disponible</p>
        <p className="text-caption text-text-secondary">{metaError}</p>
      </div>
    );
  }
  if (!meta) {
    return <div className="card text-body text-text-secondary">Cargando ClickUp…</div>;
  }

  return (
    <div className="space-y-6">
      {cotizacionData && (
        <div
          className="card card-tight"
          style={{ background: "var(--bg-surface)", borderColor: "var(--state-info)" }}
        >
          <div className="text-body-medium" style={{ color: "var(--state-info)" }}>
            Pre-llenado desde cotización
          </div>
          <div className="text-caption text-text-secondary mt-1">
            <strong>{cotizacionData.cotizacion.nombre}</strong> — descripción,
            horas y título ya están listos. Solo falta elegir asignado, proyecto y
            ajustar si quieres.
          </div>
        </div>
      )}
      <ProgressBar paso={paso} total={PASOS.length} pasos={PASOS} />

      {/* Pasos */}
      {paso === 0 && (
        <PasoAsignado
          usuarios={meta.usuarios}
          seleccionado={form.asignado}
          onChange={(u) => setForm({ ...form, asignado: u })}
        />
      )}
      {paso === 1 && (
        <PasoProyecto
          proyectos={meta.proyectos}
          valor={form.proyecto}
          onChange={(nombre) => setForm({ ...form, proyecto: nombre, carril: null })}
        />
      )}
      {paso === 2 && (
        <PasoTipo
          form={form}
          subTiposDisponibles={subTiposDisponibles}
          carriles={carriles}
          esListaNueva={!listaSeleccionada}
          onChangeTipo={(t) => setForm({ ...form, tipo: t, subTipo: SUBTIPOS_POR_TIPO[t][0] ?? null })}
          onChangeSubTipo={(s) => setForm({ ...form, subTipo: s })}
          onChangeCarril={(c) => setForm({ ...form, carril: c })}
        />
      )}
      {paso === 3 && (
        <PasoDescripcion
          form={form}
          onChangeTitulo={(t) => setForm({ ...form, titulo: t })}
          onChangeDescripcion={(d) => setForm({ ...form, descripcionMd: d })}
          onAplicarFormato={(r) =>
            setForm((f) => ({
              ...f,
              titulo: f.titulo.trim() || r.titulo_corto,
              descripcionMd: r.descripcion_md,
            }))
          }
          onAdjuntosChange={(files) => setForm((f) => ({ ...f, adjuntos: files }))}
        />
      )}
      {paso === 4 && (
        <PasoPrioridad
          seleccionada={form.prioridad}
          onChange={(p) => setForm({ ...form, prioridad: p })}
        />
      )}
      {paso === 5 && (
        <PasoHoras
          form={form}
          onChange={(v) => setForm({ ...form, horasEstimadas: v })}
          onSugerir={(r) =>
            setForm((f) => ({
              ...f,
              horasEstimadas: String(r.horas),
              justificacionHoras: r.justificacion,
            }))
          }
        />
      )}
      {paso === 6 && <PasoResumen form={form} esListaNueva={!listaSeleccionada} />}

      {/* Acciones */}
      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}

      <div
        className="flex items-center justify-between gap-3 sticky bottom-4 pt-4 mt-4"
        style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-base)" }}
      >
        <button
          type="button"
          onClick={() => setPaso((p) => Math.max(0, p - 1))}
          disabled={paso === 0 || enviando}
          className="btn-secondary"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          <span>Atrás</span>
        </button>
        {paso < PASOS.length - 1 ? (
          <button
            type="button"
            onClick={() => setPaso((p) => Math.min(PASOS.length - 1, p + 1))}
            disabled={!puedeAvanzar || enviando}
            className="btn-primary"
          >
            <span>Siguiente</span>
            <ArrowRight size={16} strokeWidth={1.75} />
          </button>
        ) : (
          <button type="button" onClick={crear} disabled={enviando} className="btn-primary">
            <Send size={16} strokeWidth={1.75} />
            <span>{enviando ? "Creando…" : "Crear y enviar"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Progress bar + lista de pasos ───────────────────────────────────────

function ProgressBar({ paso, total, pasos }: { paso: number; total: number; pasos: string[] }) {
  const pct = ((paso + 1) / total) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-caption text-text-secondary">
        <span>
          Paso {paso + 1} de {total} ·{" "}
          <strong className="text-text-primary font-semibold">{pasos[paso]}</strong>
        </span>
        <span className="num-tabular">{Math.round(pct)}%</span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ background: "var(--bg-overlay)", height: 6 }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: "#0066FF" }}
        />
      </div>
    </div>
  );
}

// ── Paso 1: Asignado ────────────────────────────────────────────────────

function PasoAsignado({
  usuarios,
  seleccionado,
  onChange,
}: {
  usuarios: ClickUpUsuario[];
  seleccionado: ClickUpUsuario | null;
  onChange: (u: ClickUpUsuario) => void;
}) {
  const [q, setQ] = useState("");
  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return usuarios;
    return usuarios.filter(
      (u) =>
        u.username.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
    );
  }, [usuarios, q]);

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2">
        <UserIcon size={18} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-heading-2">¿Para quién es el ticket?</h2>
      </div>

      <div className="input flex items-center gap-2" style={{ padding: "0 12px" }}>
        <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
        <input
          className="flex-1 bg-transparent outline-none border-0"
          placeholder="Buscar por nombre o correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
        {filtrados.map((u) => {
          const activo = seleccionado?.id === u.id;
          return (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onChange(u)}
                className="w-full flex items-center gap-3 text-left p-3 rounded-[10px] transition-colors"
                style={{
                  background: activo ? "var(--bg-overlay)" : "var(--bg-surface)",
                  border: `1px solid ${activo ? "#0066FF" : "var(--border-subtle)"}`,
                }}
              >
                <div
                  className="rounded-full inline-flex items-center justify-center text-caption font-semibold"
                  style={{
                    width: 32,
                    height: 32,
                    background: "var(--bg-overlay)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {u.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body-medium truncate">{u.username}</div>
                  {u.email && (
                    <div className="text-caption text-text-tertiary truncate">{u.email}</div>
                  )}
                </div>
                {activo && (
                  <Check size={16} strokeWidth={1.75} style={{ color: "#0066FF" }} />
                )}
              </button>
            </li>
          );
        })}
        {filtrados.length === 0 && (
          <li className="col-span-full text-caption text-text-tertiary text-center py-6">
            Sin resultados para “{q}”
          </li>
        )}
      </ul>
    </section>
  );
}

// ── Paso 2: Proyecto (Lista de ClickUp, existente o nueva) ──────────────

function PasoProyecto({
  proyectos,
  valor,
  onChange,
}: {
  proyectos: ClickUpProyecto[];
  valor: string;
  onChange: (nombre: string) => void;
}) {
  const filtrados = useMemo(() => {
    const term = valor.trim().toLowerCase();
    if (!term) return proyectos;
    return proyectos.filter((p) => p.name.toLowerCase().includes(term));
  }, [proyectos, valor]);

  const matchExacto = proyectos.some(
    (p) => p.name.trim().toLowerCase() === valor.trim().toLowerCase()
  );

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2">
        <FolderKanban size={18} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-heading-2">¿Para qué cliente/proyecto?</h2>
      </div>
      <div className="input flex items-center gap-2" style={{ padding: "0 12px" }}>
        <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
        <input
          className="flex-1 bg-transparent outline-none border-0"
          placeholder="Buscar o escribir uno nuevo…"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
        {valor && (
          <button type="button" onClick={() => onChange("")} className="text-text-tertiary">
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {valor.trim() && !matchExacto && (
        <p className="text-caption" style={{ color: "var(--state-info)" }}>
          No existe todavía — se creará una carpeta y lista nuevas “{valor.trim()}” en ClickUp.
        </p>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
        {filtrados.map((p) => {
          const activo = valor.trim().toLowerCase() === p.name.trim().toLowerCase();
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(p.name)}
                className="w-full flex items-center gap-3 text-left p-3 rounded-[10px]"
                style={{
                  background: activo ? "var(--bg-overlay)" : "var(--bg-surface)",
                  border: `1px solid ${activo ? "#0066FF" : "var(--border-subtle)"}`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-body-medium truncate">{p.name}</div>
                </div>
                {activo && <Check size={16} strokeWidth={1.75} style={{ color: "#0066FF" }} />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Paso 3: Tipo + subtipo + carril ─────────────────────────────────────

function PasoTipo({
  form,
  subTiposDisponibles,
  carriles,
  esListaNueva,
  onChangeTipo,
  onChangeSubTipo,
  onChangeCarril,
}: {
  form: Form;
  subTiposDisponibles: SubTipoTicket[];
  carriles: string[] | null;
  esListaNueva: boolean;
  onChangeTipo: (t: TipoTicket) => void;
  onChangeSubTipo: (s: SubTipoTicket) => void;
  onChangeCarril: (c: string) => void;
}) {
  const requiereSub = subTiposDisponibles.length > 1;

  return (
    <section className="card space-y-5">
      <div className="flex items-center gap-2">
        <Tag size={18} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-heading-2">Tipo de ticket</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TIPOS.map((t) => {
          const activo = form.tipo === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeTipo(t.id)}
              className="text-left p-4 rounded-[10px]"
              style={{
                background: activo ? "var(--bg-overlay)" : "var(--bg-surface)",
                border: `1px solid ${activo ? "#0066FF" : "var(--border-subtle)"}`,
              }}
            >
              <div className="text-body-medium">{t.label}</div>
              <div className="text-caption text-text-secondary mt-1">{t.desc}</div>
            </button>
          );
        })}
      </div>

      {requiereSub && (
        <div className="space-y-2">
          <div className="text-overline text-text-tertiary">Sub-tipo</div>
          <div className="flex flex-wrap gap-2">
            {subTiposDisponibles.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeSubTipo(s)}
                className={`btn-sm whitespace-nowrap ${
                  form.subTipo === s ? "btn-primary" : "btn-secondary"
                }`}
              >
                {SUBTIPO_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-overline text-text-tertiary">
          Carril inicial (opcional)
        </div>
        {esListaNueva ? (
          <p className="text-caption text-text-tertiary">
            Es un proyecto nuevo — se creará con los carriles por defecto de ClickUp.
          </p>
        ) : carriles === null ? (
          <p className="text-caption text-text-tertiary">Cargando carriles…</p>
        ) : carriles.length === 0 ? (
          <p className="text-caption text-text-tertiary">
            Sin carriles. Se creará en el inicial por defecto.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {carriles.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChangeCarril(c)}
                className={`btn-sm whitespace-nowrap ${
                  form.carril === c ? "btn-primary" : "btn-secondary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Paso 4: Descripción + título ────────────────────────────────────────

const MIME_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;

function PasoDescripcion({
  form,
  onChangeTitulo,
  onChangeDescripcion,
  onAplicarFormato,
  onAdjuntosChange,
}: {
  form: Form;
  onChangeTitulo: (t: string) => void;
  onChangeDescripcion: (d: string) => void;
  onAplicarFormato: (r: { titulo_corto: string; descripcion_md: string }) => void;
  onAdjuntosChange: (files: File[]) => void;
}) {
  const [formateando, setFormateando] = useState(false);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);

  const formatearConIA = async () => {
    setErrorIA(null);
    const texto = form.descripcionMd.trim();
    if (!texto && !form.titulo.trim()) {
      setErrorIA(
        "Escribe algo en la descripción o el título primero para que la IA tenga qué formatear."
      );
      return;
    }
    if (!form.tipo) {
      setErrorIA("Elige el tipo de ticket antes de formatear.");
      return;
    }
    setFormateando(true);
    try {
      const combinado = [form.titulo.trim(), texto].filter(Boolean).join("\n\n");
      const res = await fetch("/api/tickets/formatear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: combinado,
          tipo: form.tipo,
          sub_tipo: form.subTipo,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErrorIA(j.error || "Error consultando la IA");
        return;
      }
      onAplicarFormato({ titulo_corto: j.titulo_corto, descripcion_md: j.descripcion_md });
    } catch {
      setErrorIA("Error de red");
    } finally {
      setFormateando(false);
    }
  };

  const onPickFiles = (filesPicked: FileList | null) => {
    if (!filesPicked) return;
    setErrorAdjunto(null);
    const nuevos: File[] = [];
    const rechazos: string[] = [];
    Array.from(filesPicked).forEach((f) => {
      if (form.adjuntos.length + nuevos.length >= MAX_FILES) {
        rechazos.push(`${f.name}: límite ${MAX_FILES} archivos`);
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        rechazos.push(`${f.name}: excede 5 MB`);
        return;
      }
      if (!MIME_PERMITIDOS.includes(f.type)) {
        rechazos.push(`${f.name}: tipo no soportado`);
        return;
      }
      nuevos.push(f);
    });
    if (nuevos.length > 0) {
      onAdjuntosChange([...form.adjuntos, ...nuevos]);
    }
    if (rechazos.length > 0) {
      setErrorAdjunto(rechazos.join(" · "));
    }
  };

  const quitarAdjunto = (idx: number) => {
    onAdjuntosChange(form.adjuntos.filter((_, i) => i !== idx));
  };

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={18} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-heading-2">Descripción</h2>
      </div>

      <div>
        <label className="field-label">Título corto *</label>
        <input
          className="input"
          value={form.titulo}
          onChange={(e) => onChangeTitulo(e.target.value)}
          placeholder="Ej: Cambio de contraseña de cuenta de servidor"
        />
        <span className="field-hint">
          Se le aplica el prefijo del tipo automáticamente
          (ej. “Soporte: ” si es Soporte).
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="field-label">Detalle (markdown — opcional)</label>
          <button
            type="button"
            onClick={formatearConIA}
            disabled={formateando}
            className="btn-secondary btn-sm"
            title="La IA reescribe lo que pusiste con la estructura del tipo seleccionado"
          >
            <Sparkles size={14} strokeWidth={1.75} />
            <span>{formateando ? "Formateando…" : "Formatear con IA"}</span>
          </button>
        </div>
        <textarea
          className="textarea min-h-[260px] mt-2"
          rows={12}
          value={form.descripcionMd}
          onChange={(e) => onChangeDescripcion(e.target.value)}
          placeholder="Escribe libre lo que le quieres pedir al programador. Ej: 'Fernando me pidio cambiar la contraseña del servidor de producción, ya esta en LastPass'. El botón Formatear con IA lo deja claro y completo."
        />
        {errorIA && (
          <p className="text-caption mt-2" style={{ color: "var(--state-error)" }}>
            {errorIA}
          </p>
        )}
        <span className="field-hint">
          La IA mejora tu redacción para que el programador entienda qué tiene
          que hacer. No inventa información que no escribiste — los huecos
          quedan marcados.
        </span>
      </div>

      {/* Dropzone de adjuntos */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Paperclip size={16} strokeWidth={1.75} className="text-text-secondary" />
          <div className="field-label" style={{ marginBottom: 0 }}>
            Adjuntos
          </div>
          <span className="text-caption text-text-tertiary">
            opcional — máx {MAX_FILES} archivos, 5 MB c/u
          </span>
        </div>
        <label
          className="block rounded-[10px] p-4 text-center cursor-pointer transition-colors"
          style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-default)" }}
        >
          <input
            type="file"
            multiple
            accept={MIME_PERMITIDOS.join(",")}
            className="hidden"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          <Paperclip size={20} strokeWidth={1.5} className="text-text-tertiary mx-auto mb-1" />
          <div className="text-body-medium">Clic para elegir archivos</div>
          <div className="text-caption text-text-tertiary">
            Imágenes (png/jpg/gif/webp), PDF, DOCX, XLSX, TXT, ZIP
          </div>
        </label>

        {form.adjuntos.length > 0 && (
          <ul className="space-y-2">
            {form.adjuntos.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-3 rounded-[10px] p-3"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-body-medium truncate">{f.name}</div>
                  <div className="text-caption text-text-tertiary num-tabular">
                    {(f.size / 1024).toFixed(1)} KB · {f.type || "?"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => quitarAdjunto(i)}
                  className="btn-icon btn-ghost"
                  aria-label={`Quitar ${f.name}`}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {errorAdjunto && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {errorAdjunto}
          </p>
        )}
      </div>
    </section>
  );
}

// ── Paso 5: Prioridad ───────────────────────────────────────────────────

function PasoPrioridad({
  seleccionada,
  onChange,
}: {
  seleccionada: string | null;
  onChange: (p: string) => void;
}) {
  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2">
        <Flag size={18} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-heading-2">Prioridad</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {PRIORIDADES_UI.map((p) => {
          const activo = seleccionada === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className="p-3 rounded-[10px] text-center"
              style={{
                background: activo ? "var(--bg-overlay)" : "var(--bg-surface)",
                border: `2px solid ${activo ? p.color : "var(--border-subtle)"}`,
              }}
            >
              <div className="num-tabular" style={{ color: p.color, fontWeight: 700, fontSize: 14 }}>
                {p.label}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Paso 6: Horas ───────────────────────────────────────────────────────

function PasoHoras({
  form,
  onChange,
  onSugerir,
}: {
  form: Form;
  onChange: (v: string) => void;
  onSugerir: (r: { horas: number; justificacion: string }) => void;
}) {
  const [sugiriendo, setSugiriendo] = useState(false);
  const [errorIA, setErrorIA] = useState<string | null>(null);

  const sugerir = async () => {
    setErrorIA(null);
    if (!form.descripcionMd.trim()) {
      setErrorIA("Necesito una descripción en el paso anterior para estimar.");
      return;
    }
    if (!form.tipo) {
      setErrorIA("Falta el tipo de ticket.");
      return;
    }
    setSugiriendo(true);
    try {
      const res = await fetch("/api/tickets/recomendar-horas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion_md: form.descripcionMd,
          tipo: form.tipo,
          sub_tipo: form.subTipo,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErrorIA(j.error || "Error consultando la IA");
        return;
      }
      onSugerir({ horas: j.horas, justificacion: j.justificacion });
    } catch {
      setErrorIA("Error de red");
    } finally {
      setSugiriendo(false);
    }
  };

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={18} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-heading-2">Horas estimadas</h2>
      </div>
      <p className="text-caption text-text-secondary">
        Opcional. Si lo dejas vacío, no se manda estimación a ClickUp.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="input num-tabular text-center"
          type="number"
          min={0}
          step={0.5}
          inputMode="decimal"
          value={form.horasEstimadas}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          style={{ maxWidth: 120 }}
        />
        <span className="text-body text-text-secondary">horas</span>
        <button
          type="button"
          onClick={sugerir}
          disabled={sugiriendo}
          className="btn-secondary btn-sm ml-auto"
        >
          <Sparkles size={14} strokeWidth={1.75} />
          <span>{sugiriendo ? "Calculando…" : "Sugerir con IA"}</span>
        </button>
      </div>

      {form.justificacionHoras && (
        <div
          className="rounded-[10px] p-3 text-caption"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="text-overline text-text-tertiary mb-1">Justificación IA</div>
          <p className="text-body text-text-secondary">{form.justificacionHoras}</p>
        </div>
      )}

      {errorIA && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {errorIA}
        </p>
      )}
    </section>
  );
}

// ── Paso 7: Resumen ─────────────────────────────────────────────────────

function PasoResumen({ form, esListaNueva }: { form: Form; esListaNueva: boolean }) {
  const tipoLabel = TIPOS.find((t) => t.id === form.tipo)?.label ?? "";
  const prioridadLabel = PRIORIDADES_UI.find((p) => p.id === form.prioridad)?.label ?? "";
  const prefijo =
    form.tipo === "estimacion"
      ? "Estimación: "
      : form.tipo === "soporte"
      ? "Soporte: "
      : form.tipo === "investigacion"
      ? "Investigación: "
      : "";
  const tituloFinal = `${prefijo}${form.titulo.trim()}`;

  return (
    <section className="card space-y-4">
      <h2 className="text-heading-2">Resumen</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Linea label="Asignado" valor={form.asignado?.username ?? "—"} />
        <Linea label="Correo" valor={form.asignado?.email ?? "—"} />
        <Linea
          label="Proyecto"
          valor={`${form.proyecto || "—"}${esListaNueva ? " (proyecto nuevo)" : ""}`}
        />
        <Linea label="Carril inicial" valor={form.carril ?? "— (por defecto)"} />
        <Linea
          label="Tipo"
          valor={`${tipoLabel}${form.subTipo ? ` · ${SUBTIPO_LABEL[form.subTipo]}` : ""}`}
        />
        <Linea label="Prioridad" valor={prioridadLabel} />
        <Linea
          label="Horas estimadas"
          valor={form.horasEstimadas.trim() ? `${form.horasEstimadas}h` : "—"}
        />
      </div>

      <div>
        <div className="text-overline text-text-tertiary mb-1">Título final</div>
        <div className="text-body-medium">{tituloFinal || "—"}</div>
      </div>

      <div>
        <div className="text-overline text-text-tertiary mb-1">Descripción</div>
        <pre
          className="rounded-[10px] p-4 whitespace-pre-wrap text-body"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {form.descripcionMd.trim() || "(sin descripción)"}
        </pre>
      </div>

      {form.adjuntos.length > 0 && (
        <div>
          <div className="text-overline text-text-tertiary mb-1">
            Adjuntos ({form.adjuntos.length})
          </div>
          <ul className="space-y-1">
            {form.adjuntos.map((f, i) => (
              <li key={`r-${f.name}-${i}`} className="text-body flex items-center justify-between gap-3">
                <span className="truncate">{f.name}</span>
                <span className="num-tabular text-caption text-text-tertiary whitespace-nowrap">
                  {(f.size / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Linea({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="text-overline text-text-tertiary">{label}</div>
      <div className="text-body-medium">{valor}</div>
    </div>
  );
}
