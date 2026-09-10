"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles, RefreshCcw } from "lucide-react";
import TareasTabla, { TareaRow } from "@/components/forms/TareasTabla";
import ProyectoSearch from "@/components/forms/ProyectoSearch";
import BufferSelector from "@/components/forms/BufferSelector";
import Markdown from "@/components/ui/Markdown";
import { totalesPERT, aplicarBuffer } from "@/lib/pert";

type Programador = { id: string; nombre: string };
type Proyecto = { id: string; nombre: string };
type Prioridad = "alta" | "media" | "baja";
type Tarea = {
  id?: string;
  orden: number;
  nombre_limpio: string;
  descripcion_limpia: string | null;
  hrs_min: number;
  hrs_max: number;
};

const PRIORIDADES: { value: Prioridad; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

// Azul = baja, amarillo = media, rojo = alta — mismo esquema en todo el sistema.
const PRIORIDAD_COLOR: Record<Prioridad, { bg: string; fg: string }> = {
  baja: { bg: "#DBEAFE", fg: "#1D4ED8" },
  media: { bg: "#FEF3C7", fg: "#B45309" },
  alta: { bg: "#FEE2E2", fg: "#DC2626" },
};

type Props = {
  cotizacionId: string;
  programadores: Programador[];
  proyectos: Proyecto[];
  programadorIdInicial: string | null;
  proyectoIdInicial: string | null;
  notasInicial: string | null;
  bufferInicial: number;
  prioridadInicial: Prioridad;
  tareasIniciales: Tarea[];
  iaRecomendacion: string | null;
};

function tareasAFilas(tareas: Tarea[]): TareaRow[] {
  return tareas.map((t) => ({
    nombre: t.nombre_limpio,
    descripcion: t.descripcion_limpia ?? "",
    hrs_min: String(t.hrs_min ?? ""),
    hrs_max: String(t.hrs_max ?? ""),
  }));
}

/**
 * Editor de la estimación en etapa temprana (por_estimar /
 * pendiente_revision_interna) — mismo look & feel que el formulario de
 * creación (EstimacionForm): Datos generales, Tareas y horas, Resumen con
 * buffer. Todo se guarda junto con un solo botón, a diferencia de las cards
 * independientes que se usan más adelante en el flujo (Proyecto, Análisis
 * financiero, etc. una vez que ya se envió a aprobación).
 */
export default function EstimacionTempranaEditor({
  cotizacionId,
  programadores,
  proyectos,
  programadorIdInicial,
  proyectoIdInicial,
  notasInicial,
  bufferInicial,
  prioridadInicial,
  tareasIniciales,
  iaRecomendacion,
}: Props) {
  const router = useRouter();

  const [programadorId, setProgramadorId] = useState(programadorIdInicial ?? "");
  const [proyectoId, setProyectoId] = useState(proyectoIdInicial ?? "");
  const [prioridad, setPrioridad] = useState<Prioridad>(prioridadInicial);
  const [notas, setNotas] = useState(notasInicial ?? "");
  const [bufferPct, setBufferPct] = useState(bufferInicial);
  const [rows, setRows] = useState<TareaRow[]>(
    tareasIniciales.length > 0
      ? tareasAFilas(tareasIniciales)
      : [{ nombre: "", descripcion: "", hrs_min: "", hrs_max: "" }]
  );
  const [comentario, setComentario] = useState("");

  const [saving, setSaving] = useState(false);
  const [procesandoIA, setProcesandoIA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const totales = useMemo(
    () =>
      totalesPERT(
        rows.map((r) => ({
          hrs_min: Number(r.hrs_min) || 0,
          hrs_max: Number(r.hrs_max) || 0,
        }))
      ),
    [rows]
  );
  const totalesConBuffer = useMemo(
    () => aplicarBuffer(totales, bufferPct),
    [totales, bufferPct]
  );

  const guardar = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const proyecto = proyectos.find((p) => p.id === proyectoId);
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programador_id: programadorId || null,
          prioridad,
          proyecto_clickup_id: proyectoId || null,
          proyecto_nombre: proyecto?.nombre ?? null,
          notas_programador: notas.trim() || null,
          buffer_porcentaje: bufferPct,
          horas_min: totales.totalMin,
          horas_max: totales.totalMax,
          tareas: rows.map((r, i) => ({
            orden: i,
            nombre_limpio: r.nombre.trim(),
            descripcion_limpia: r.descripcion.trim() || null,
            hrs_min: Number(r.hrs_min) || 0,
            hrs_max: Number(r.hrs_max) || 0,
          })),
          comentario: comentario.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo guardar");
        return;
      }
      setComentario("");
      setOk(true);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  const procesarIA = async () => {
    setProcesandoIA(true);
    setError(null);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/procesar-ia`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error procesando con IA");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setProcesandoIA(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Datos generales */}
      <section className="card space-y-5">
        <h2 className="text-heading-2">Datos generales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Estimador</label>
            <select
              className="input"
              value={programadorId}
              onChange={(e) => setProgramadorId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {programadores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Prioridad</label>
            <div className="flex gap-2 h-[38px] items-center">
              {PRIORIDADES.map((p) => {
                const activa = prioridad === p.value;
                const c = PRIORIDAD_COLOR[p.value];
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPrioridad(p.value)}
                    className="btn-sm"
                    style={{
                      background: activa ? c.bg : "transparent",
                      color: activa ? c.fg : "var(--text-secondary)",
                      border: `1px solid ${activa ? c.bg : "var(--border-default)"}`,
                      fontWeight: activa ? 600 : 500,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="field-label">
              Proyecto {proyectos.length === 0 && (
                <span className="text-text-tertiary font-normal">(sin proyectos activos)</span>
              )}
            </label>
            <ProyectoSearch
              proyectos={proyectos}
              value={proyectoId}
              onChange={setProyectoId}
              disabled={proyectos.length === 0}
            />
          </div>
        </div>
      </section>

      {/* Tareas y horas */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-heading-2">Tareas y horas</h2>
          <span className="text-caption text-text-tertiary">
            El esperado se calcula automáticamente
          </span>
        </div>
        <TareasTabla rows={rows} onChange={setRows} />
      </section>

      {/* Formatear con IA */}
      <section
        className="card space-y-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        {iaRecomendacion ? (
          <>
            <div className="text-overline text-text-tertiary">Recomendación IA</div>
            <Markdown text={iaRecomendacion} className="text-body text-text-primary" />
          </>
        ) : (
          <p className="text-body text-text-secondary">
            Claude puede limpiar el texto de las tareas y sugerir si las horas
            son adecuadas. No es obligatorio para avanzar.
          </p>
        )}
        <button
          type="button"
          onClick={procesarIA}
          disabled={procesandoIA || rows.every((r) => !r.nombre.trim())}
          className={iaRecomendacion ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
        >
          {iaRecomendacion ? (
            <RefreshCcw size={14} strokeWidth={1.75} />
          ) : (
            <Sparkles size={14} strokeWidth={1.75} />
          )}
          <span>
            {procesandoIA ? "Procesando…" : iaRecomendacion ? "Reprocesar con IA" : "Formatear con IA"}
          </span>
        </button>
      </section>

      {/* Resumen + Buffer */}
      <section className="card space-y-6">
        <h2 className="text-heading-2">Resumen</h2>

        <div>
          <div className="text-overline text-text-tertiary mb-3">Horas originales</div>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-caption text-text-tertiary">Mínimo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalMin}h
              </div>
            </div>
            <div className="text-center border-l border-r" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="text-caption text-text-tertiary">PERT esperado</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalEsperado}h
              </div>
            </div>
            <div className="text-center">
              <div className="text-caption text-text-tertiary">Máximo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalMax}h
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-overline text-text-tertiary pt-4">Buffer adicional</div>
          <p className="text-caption text-text-secondary">
            Margen extra que se suma a la estimación, para cubrir imprevistos. Se puede cambiar en cualquier momento.
          </p>
          <BufferSelector value={bufferPct} onChange={setBufferPct} />
        </div>

        {bufferPct > 0 && (
          <div
            className="rounded-[10px] p-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="text-overline text-text-tertiary mb-3">
              Total con buffer (+{bufferPct}%)
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-caption text-text-tertiary">Mínimo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalMin}h
                </div>
              </div>
              <div className="text-center border-l border-r" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="text-caption text-text-tertiary">PERT esperado</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalEsperado}h
                </div>
              </div>
              <div className="text-center">
                <div className="text-caption text-text-tertiary">Máximo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalMax}h
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Notas */}
      <section className="card">
        <label className="field-label">Notas generales</label>
        <span className="field-hint mb-2">Opcional — supuestos o advertencias globales</span>
        <textarea
          className="textarea min-h-[100px] mt-2"
          rows={4}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </section>

      {/* Guardar */}
      <section className="card space-y-3" style={{ background: "var(--bg-surface)" }}>
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
        {ok && !error && (
          <p className="text-caption" style={{ color: "var(--state-success)" }}>
            Guardado.
          </p>
        )}
        <button type="button" onClick={guardar} disabled={saving} className="btn-primary">
          <Save size={16} strokeWidth={1.75} />
          <span>{saving ? "Guardando…" : "Guardar cambios"}</span>
        </button>
      </div>
    </div>
  );
}
