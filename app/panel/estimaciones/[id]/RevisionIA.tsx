"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Sparkles,
  RefreshCcw,
  ArrowRight,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import Markdown from "@/components/ui/Markdown";
import Modal from "@/components/ui/Modal";
import SlackText from "@/components/ui/SlackText";
import AnalisisFinanciero from "@/components/forms/AnalisisFinanciero";
import BufferEditor from "@/components/forms/BufferEditor";
import SlackPreview from "@/components/forms/SlackPreview";
import type { EstimacionCruda, EstimacionLimpia } from "@/lib/anthropic/process";
import { totalesPERT, aplicarBuffer } from "@/lib/pert";
import { buildSlackText, shortDescripcion, puntosFallback } from "@/lib/slack/format";

type Props = {
  estimacionId: string;
  raw: EstimacionCruda & {
    buffer_porcentaje?: number;
    precio_venta_hora?: number;
    proyecto_nombre?: string | null;
    envio?: {
      tipo: "min" | "pert" | "max" | "custom";
      custom?: number | null;
      horas?: number;
    } | null;
    slack_text_override?: string | null;
  };
  limpiaInicial: EstimacionLimpia | null;
  programador: string;
  precioHora: number;
  cotizacionRef: string | null;
};

export default function RevisionIA({
  estimacionId,
  raw,
  limpiaInicial,
  programador,
  precioHora,
  cotizacionRef,
}: Props) {
  const router = useRouter();
  const [limpia, setLimpia] = useState<EstimacionLimpia | null>(limpiaInicial);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [cotId, setCotId] = useState<string | null>(cotizacionRef);
  const [previewAbierto, setPreviewAbierto] = useState(false);

  // Totales del set de tareas vigente (limpio si existe, original si no)
  const totalesVigentes = useMemo(() => {
    const tareas = limpia?.tareas ?? raw.tareas;
    return totalesPERT(
      tareas.map((t) => ({ hrs_min: t.hrs_min || 0, hrs_max: t.hrs_max || 0 }))
    );
  }, [limpia, raw]);

  const bufferPct = raw.buffer_porcentaje ?? 0;
  const totalesConBuffer = useMemo(
    () => aplicarBuffer(totalesVigentes, bufferPct),
    [totalesVigentes, bufferPct]
  );

  const procesar = async () => {
    setProcesando(true);
    setError(null);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}/procesar`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error procesando con IA");
        return;
      }
      setLimpia(json.datos_limpios);
      setDirty(false);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setProcesando(false);
    }
  };

  const guardar = async () => {
    if (!limpia) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}/guardar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limpia),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error guardando");
        return;
      }
      setDirty(false);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setGuardando(false);
    }
  };

  const crearCotizacion = async () => {
    setCreando(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}/crear-cotizacion`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al crear la cotización");
        return;
      }
      setCotId(json.cotizacion_id);
      if (json.clickup_warning) setWarning(json.clickup_warning);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setCreando(false);
    }
  };

  const updateLimpia = (patch: Partial<EstimacionLimpia>) => {
    if (!limpia) return;
    setLimpia({ ...limpia, ...patch });
    setDirty(true);
  };

  const updateTarea = (i: number, patch: Partial<EstimacionLimpia["tareas"][number]>) => {
    if (!limpia) return;
    setLimpia({
      ...limpia,
      tareas: limpia.tareas.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    });
    setDirty(true);
  };

  const addTarea = () => {
    if (!limpia) return;
    setLimpia({
      ...limpia,
      tareas: [...limpia.tareas, { nombre: "", descripcion: "", hrs_min: 0, hrs_max: 0 }],
    });
    setDirty(true);
  };

  const removeTarea = (i: number) => {
    if (!limpia) return;
    setLimpia({
      ...limpia,
      tareas: limpia.tareas.filter((_, idx) => idx !== i),
    });
    setDirty(true);
  };

  /* ─── Pre-IA: tareas originales + totales ──────────────────────────── */

  if (!limpia) {
    return (
      <section className="space-y-6">
        {/* Totales pre-IA */}
        <section className="card space-y-6">
          <h2 className="text-heading-2">Resumen de la estimación</h2>

          <div>
            <div className="text-overline text-text-tertiary mb-3">Horas originales</div>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-caption text-text-tertiary">Mínimo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                  {totalesVigentes.totalMin}h
                </div>
              </div>
              <div>
                <div className="text-caption text-text-tertiary">PERT</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                  {totalesVigentes.totalEsperado}h
                </div>
              </div>
              <div>
                <div className="text-caption text-text-tertiary">Máximo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                  {totalesVigentes.totalMax}h
                </div>
              </div>
            </div>
          </div>

          {bufferPct > 0 && (
            <div
              className="rounded-[10px] p-4"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="text-overline text-text-tertiary mb-3">
                Con buffer (+{bufferPct}%)
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-caption text-text-tertiary">Mínimo</div>
                  <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalesConBuffer.totalMin}h
                  </div>
                </div>
                <div>
                  <div className="text-caption text-text-tertiary">PERT</div>
                  <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalesConBuffer.totalEsperado}h
                  </div>
                </div>
                <div>
                  <div className="text-caption text-text-tertiary">Máximo</div>
                  <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 700 }}>
                    {totalesConBuffer.totalMax}h
                  </div>
                </div>
              </div>
            </div>
          )}

        </section>

        <BufferEditor estimacionId={estimacionId} valorInicial={bufferPct} />

        <AnalisisFinanciero
          savePath={`/api/estimaciones/${estimacionId}/precio-venta`}
          precioHoraInterno={precioHora}
          precioVentaInicial={raw.precio_venta_hora ?? null}
          horasMin={totalesConBuffer.totalMin}
          horasMax={totalesConBuffer.totalMax}
        />

        <div className="card" style={{ background: "var(--bg-surface)" }}>
          <p className="text-body-medium mb-1">Esta estimación aún no ha sido procesada</p>
          <p className="text-caption text-text-secondary">
            Claude limpiará el texto, sugerirá si las horas son adecuadas y generará borradores
            para Sherlyn y para el cliente.
          </p>
        </div>

        <button onClick={procesar} disabled={procesando} className="btn-primary">
          <Sparkles size={16} strokeWidth={1.75} />
          <span>{procesando ? "Procesando con Claude…" : "Procesar con IA"}</span>
        </button>
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-heading-2">Tareas originales ({raw.tareas.length})</h2>
          <ul className="space-y-3">
            {raw.tareas.map((t, i) => (
              <li key={i} className="card card-tight space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-body-medium">{t.nombre}</h3>
                  <span className="text-caption text-text-tertiary num-tabular whitespace-nowrap">
                    {t.hrs_min}–{t.hrs_max} h
                  </span>
                </div>
                {t.descripcion && (
                  <p className="text-body text-text-secondary whitespace-pre-wrap">
                    {t.descripcion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </section>
    );
  }

  /* ─── Post-IA: edición completa ─────────────────────────────────────── */

  return (
    <section className="space-y-6">
      <div className="card" style={{ background: "var(--bg-surface)" }}>
        <div className="text-overline text-text-tertiary mb-2">Recomendación IA</div>
        <Markdown text={limpia.recomendacion_horas} className="text-body text-text-primary" />
      </div>

      <section className="card space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-2">Resumen</h2>
          <span className="text-caption text-text-secondary">Programador: <strong className="font-semibold">{programador}</strong></span>
        </div>

        <div>
          <div className="text-overline text-text-tertiary mb-3">Horas originales</div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-caption text-text-tertiary">Mínimo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                {totalesVigentes.totalMin}h
              </div>
            </div>
            <div>
              <div className="text-caption text-text-tertiary">PERT</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                {totalesVigentes.totalEsperado}h
              </div>
            </div>
            <div>
              <div className="text-caption text-text-tertiary">Máximo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 600 }}>
                {totalesVigentes.totalMax}h
              </div>
            </div>
          </div>
        </div>

        {bufferPct > 0 && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="text-overline text-text-tertiary mb-3">
              Con buffer (+{bufferPct}%)
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-caption text-text-tertiary">Mínimo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 700 }}>
                  {totalesConBuffer.totalMin}h
                </div>
              </div>
              <div>
                <div className="text-caption text-text-tertiary">PERT</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 700 }}>
                  {totalesConBuffer.totalEsperado}h
                </div>
              </div>
              <div>
                <div className="text-caption text-text-tertiary">Máximo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 22, fontWeight: 700 }}>
                  {totalesConBuffer.totalMax}h
                </div>
              </div>
            </div>
          </div>
        )}

      </section>

      <AnalisisFinanciero
        savePath={`/api/estimaciones/${estimacionId}/precio-venta`}
        precioHoraInterno={precioHora}
        precioVentaInicial={raw.precio_venta_hora ?? null}
        horasMin={totalesConBuffer.totalMin}
        horasMax={totalesConBuffer.totalMax}
      />

      <section className="card space-y-2">
        <label className="field-label">Nombre de la solicitud (limpio)</label>
        <input
          className="input"
          value={limpia.nombre_solicitud}
          onChange={(e) => updateLimpia({ nombre_solicitud: e.target.value })}
        />
        <span className="field-hint">
          Original: <em>{raw.nombre_solicitud}</em>
        </span>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-2">Tareas ({limpia.tareas.length})</h2>
        </div>
        <ul className="space-y-3">
          {limpia.tareas.map((t, i) => (
            <li
              key={i}
              className="rounded-[12px] border overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
                boxShadow: "var(--shadow-sm)",
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
                <button
                  type="button"
                  onClick={() => removeTarea(i)}
                  aria-label={`Eliminar tarea ${i + 1}`}
                  title="Eliminar tarea"
                  className="btn-icon btn-ghost"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="field-label">Nombre</label>
                  <input
                    className="input"
                    value={t.nombre}
                    onChange={(e) => updateTarea(i, { nombre: e.target.value })}
                  />
                  {raw.tareas[i] && (
                    <span className="field-hint">
                      Original: <em>{raw.tareas[i].nombre}</em>
                    </span>
                  )}
                </div>
                <div>
                  <label className="field-label">Descripción</label>
                  <textarea
                    className="textarea min-h-[100px]"
                    rows={4}
                    value={t.descripcion}
                    onChange={(e) => updateTarea(i, { descripcion: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Horas mín</label>
                    <input
                      className="input num-tabular"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={t.hrs_min}
                      onChange={(e) => updateTarea(i, { hrs_min: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="field-label">Horas máx</label>
                    <input
                      className="input num-tabular"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={t.hrs_max}
                      onChange={(e) => updateTarea(i, { hrs_max: Number(e.target.value) || 0 })}
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
          value={limpia.contexto_sherlyn}
          onChange={(e) => updateLimpia({ contexto_sherlyn: e.target.value })}
        />
      </section>

      <section className="card">
        <label className="field-label">Borrador de correo al cliente</label>
        <textarea
          className="textarea min-h-[140px] mt-2"
          rows={6}
          value={limpia.borrador_correo}
          onChange={(e) => updateLimpia({ borrador_correo: e.target.value })}
        />
        <div
          className="mt-3 rounded-[10px] p-3 text-caption"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          <strong className="font-semibold text-text-primary">
            Horas vigentes: {totalesConBuffer.totalMin}–{totalesConBuffer.totalMax}h
          </strong>
          {bufferPct > 0 && <> · buffer +{bufferPct}%</>}
          <div className="mt-1">
            Si el texto del correo o contexto de Sherlyn menciona horas específicas,
            actualízalas a mano para que coincidan con el valor vigente. Las horas en
            el ticket de ClickUp y mensaje de Slack se actualizan automáticamente.
          </div>
        </div>
      </section>

      {/* Buffer adicional — colocado junto al mensaje de Slack para ediciones rápidas */}
      <BufferEditor estimacionId={estimacionId} valorInicial={bufferPct} />

      <SlackPreview
        estimacionId={estimacionId}
        nombreCotizacion={limpia.nombre_solicitud}
        proyecto={raw.proyecto_nombre ?? null}
        programador={programador}
        bufferPct={bufferPct}
        totalMin={totalesConBuffer.totalMin}
        totalEsperado={totalesConBuffer.totalEsperado}
        totalMax={totalesConBuffer.totalMax}
        descripcionCorta={shortDescripcion(limpia)}
        puntosClave={puntosFallback(limpia)}
        notas={raw.notas}
        envioInicial={
          raw.envio
            ? {
                tipo: raw.envio.tipo,
                custom: raw.envio.custom ?? null,
              }
            : null
        }
        slackTextOverride={raw.slack_text_override ?? null}
      />

      <div className="space-y-3">
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
        {warning && (
          <div
            className="card text-caption"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--state-warning)",
              color: "var(--text-secondary)",
            }}
          >
            {warning}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {cotId ? (
            <a href={`/panel/cotizaciones/${cotId}`} className="btn-primary">
              <CheckCircle2 size={16} strokeWidth={1.75} />
              <span>Ver cotización</span>
            </a>
          ) : (
            <button
              onClick={() => setPreviewAbierto(true)}
              disabled={creando || dirty}
              className="btn-primary"
              title={dirty ? "Guarda los cambios antes de enviar a aprobación" : ""}
            >
              <ArrowRight size={16} strokeWidth={1.75} />
              <span>Enviar a aprobación</span>
            </button>
          )}

          <button onClick={guardar} disabled={guardando || !dirty} className="btn-secondary">
            <Save size={16} strokeWidth={1.75} />
            <span>{guardando ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}</span>
          </button>

          <button onClick={procesar} disabled={procesando} className="btn-ghost">
            <RefreshCcw size={16} strokeWidth={1.75} />
            <span>{procesando ? "Reprocesando…" : "Reprocesar con IA"}</span>
          </button>
        </div>
      </div>

      <Modal
        open={previewAbierto}
        onClose={() => !creando && setPreviewAbierto(false)}
        title="Confirmar envío a aprobación"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPreviewAbierto(false)}
              disabled={creando}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                await crearCotizacion();
                setPreviewAbierto(false);
              }}
              disabled={creando}
              className="btn-primary"
            >
              <ArrowRight size={16} strokeWidth={1.75} />
              <span>{creando ? "Enviando…" : "Confirmar y enviar"}</span>
            </button>
          </>
        }
      >
        <PreviewEnvio
          limpia={limpia}
          raw={raw}
          programador={programador}
          totalesConBuffer={totalesConBuffer}
          bufferPct={bufferPct}
        />
      </Modal>
    </section>
  );
}

/* Reparte un total entre tareas usando los puntos medios como peso.
   Garantiza que la suma sea exactamente el total (ajuste en la última). */
function distribuirHoras(
  tareas: EstimacionLimpia["tareas"],
  total: number
): number[] {
  if (tareas.length === 0) return [];
  const medios = tareas.map((t) => (t.hrs_min + t.hrs_max) / 2);
  const suma = medios.reduce((a, b) => a + b, 0);
  if (suma <= 0) {
    const cada = Math.round((total / tareas.length) * 10) / 10;
    return tareas.map((_, i) =>
      i === tareas.length - 1
        ? Math.round((total - cada * (tareas.length - 1)) * 10) / 10
        : cada
    );
  }
  const escaladas = medios.map((m) => Math.round((m * total) / suma * 10) / 10);
  const diff = Math.round((total - escaladas.reduce((a, b) => a + b, 0)) * 10) / 10;
  if (diff !== 0) {
    escaladas[escaladas.length - 1] = Math.max(
      0,
      Math.round((escaladas[escaladas.length - 1] + diff) * 10) / 10
    );
  }
  return escaladas;
}

/* Componente interno: muestra cómo se verá el ticket en ClickUp y el mensaje
   en Slack antes de enviar a aprobación. */
function PreviewEnvio({
  limpia,
  raw,
  programador,
  totalesConBuffer,
  bufferPct,
}: {
  limpia: EstimacionLimpia;
  raw: Props["raw"];
  programador: string;
  totalesConBuffer: { totalMin: number; totalEsperado: number; totalMax: number };
  bufferPct: number;
}) {
  const horasEnvio =
    raw.envio?.horas != null
      ? Math.round(Number(raw.envio.horas) * 10) / 10
      : Math.round(((totalesConBuffer.totalMin + totalesConBuffer.totalMax) / 2) * 10) / 10;

  const tipoEnvio = raw.envio?.tipo ?? "pert";
  const tipoLabel: Record<string, string> = {
    min: "Mínimo",
    pert: "PERT (esperado)",
    max: "Máximo",
    custom: "Personalizado",
  };

  const horasPorTarea = distribuirHoras(limpia.tareas, horasEnvio);

  const slackText =
    raw.slack_text_override ??
    buildSlackText({
      nombreCotizacion: limpia.nombre_solicitud,
      proyecto: raw.proyecto_nombre ?? null,
      programador,
      horasEnvio,
      bufferPct,
      descripcionCorta: shortDescripcion(limpia),
      puntosClave: puntosFallback(limpia),
      notas: raw.notas,
      clickupUrl: null,
    });

  const usaOverride = raw.slack_text_override != null;

  return (
    <div className="space-y-5">
      {/* Resumen de horas que se enviarán */}
      <section
        className="rounded-[10px] p-4 space-y-1"
        style={{
          background: "var(--bg-overlay)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="text-overline text-text-tertiary">Horas a enviar</div>
        <div className="num-tabular" style={{ fontSize: 28, fontWeight: 700 }}>
          {horasEnvio}h
        </div>
        <div className="text-caption text-text-secondary">
          Selección: {tipoLabel[tipoEnvio] ?? tipoEnvio}
          {bufferPct > 0 && <> · buffer +{bufferPct}%</>} · rango con buffer{" "}
          {totalesConBuffer.totalMin}–{totalesConBuffer.totalMax}h
        </div>
      </section>

      {/* Ticket ClickUp */}
      <section className="space-y-2">
        <div className="text-overline text-text-tertiary">Ticket ClickUp</div>
        <div
          className="rounded-[10px] p-4 space-y-3"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div>
            <div className="text-caption text-text-tertiary">Nombre</div>
            <div className="text-body-medium">{limpia.nombre_solicitud}</div>
          </div>
          {raw.proyecto_nombre && (
            <div>
              <div className="text-caption text-text-tertiary">Proyecto</div>
              <div className="text-body">{raw.proyecto_nombre}</div>
            </div>
          )}

          <div>
            <div className="text-caption text-text-tertiary mb-1">
              Tareas — horas distribuidas para sumar {horasEnvio}h
            </div>
            <ul className="text-body space-y-1">
              {limpia.tareas.map((t, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-3 py-1 border-b last:border-b-0"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <span className="truncate">{t.nombre || "(sin nombre)"}</span>
                  <span className="num-tabular text-text-primary font-semibold whitespace-nowrap">
                    {horasPorTarea[i] ?? 0}h
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-3 pt-2 text-body-medium">
                <span>Total</span>
                <span className="num-tabular">
                  {horasPorTarea.reduce((a, b) => a + b, 0).toFixed(1)}h
                </span>
              </li>
            </ul>
            <p className="text-caption text-text-tertiary mt-2">
              Cada tarea se reparte proporcionalmente según su punto medio
              (mín+máx)/2, de forma que la suma sea exactamente el total.
            </p>
          </div>
        </div>
      </section>

      {/* Mensaje Slack */}
      <section className="space-y-2">
        <div className="text-overline text-text-tertiary flex items-center gap-2">
          Mensaje a Slack
          {usaOverride && <span className="badge badge-warning">Editado manualmente</span>}
        </div>
        <div
          className="rounded-[10px] p-4"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            fontFamily: "Lato, ui-sans-serif, system-ui, sans-serif",
            lineHeight: 1.5,
          }}
        >
          <SlackText text={slackText} />
        </div>
      </section>

      <p className="text-caption text-text-tertiary">
        Al confirmar se crea el ticket en ClickUp con estas horas distribuidas y se envía
        el mensaje al canal del jefe.
      </p>
    </div>
  );
}
