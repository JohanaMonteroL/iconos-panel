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
import AnalisisFinanciero from "@/components/forms/AnalisisFinanciero";
import BufferEditor from "@/components/forms/BufferEditor";
import SlackPreview from "@/components/forms/SlackPreview";
import type { EstimacionCruda, EstimacionLimpia } from "@/lib/anthropic/process";
import { totalesPERT, aplicarBuffer } from "@/lib/pert";
import { shortDescripcion, puntosFallback } from "@/lib/slack/format";

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

      <BufferEditor estimacionId={estimacionId} valorInicial={bufferPct} />

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
      </section>

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
              onClick={crearCotizacion}
              disabled={creando || dirty}
              className="btn-primary"
              title={dirty ? "Guarda los cambios antes de enviar a aprobación" : ""}
            >
              <ArrowRight size={16} strokeWidth={1.75} />
              <span>{creando ? "Enviando…" : "Enviar a aprobación"}</span>
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
    </section>
  );
}
