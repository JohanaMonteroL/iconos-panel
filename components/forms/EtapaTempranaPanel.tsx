"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCcw, ArrowRight } from "lucide-react";
import Markdown from "@/components/ui/Markdown";
import BufferEditor from "@/components/forms/BufferEditor";
import { aplicarBuffer, totalesPERT } from "@/lib/pert";

type Props = {
  cotizacionId: string;
  bufferPct: number;
  iaRecomendacion: string | null;
  horasMin: number;
  horasMax: number;
  tareasCount: number;
};

/**
 * Panel de "etapa temprana" — visible mientras la cotización está en
 * por_estimar / pendiente_revision_interna. Reemplaza al viejo flujo de
 * RevisionIA (estimaciones_formulario): procesa con IA (misma lógica de
 * procesarEstimacion, ahora sobre cotizaciones/tareas_estimacion) y encadena
 * "Enviar a aprobación" (cambiar-estado + reenviar-slack, ya existentes).
 * El resto (editar nombre/tareas, precio de venta, horas a enviar, mensaje
 * de Slack) ya se muestra en las cards normales de la página de detalle —
 * funcionan igual antes y después de procesar con IA.
 */
export default function EtapaTempranaPanel({
  cotizacionId,
  bufferPct,
  iaRecomendacion,
  horasMin,
  horasMax,
  tareasCount,
}: Props) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totales = useMemo(
    () => totalesPERT([{ hrs_min: horasMin, hrs_max: horasMax }]),
    [horasMin, horasMax]
  );
  const conBuffer = useMemo(
    () => aplicarBuffer(totales, bufferPct),
    [totales, bufferPct]
  );

  const procesar = async () => {
    setProcesando(true);
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
      setProcesando(false);
    }
  };

  const enviarAAprobacion = async () => {
    setEnviando(true);
    setError(null);
    try {
      const r1 = await fetch(`/api/cotizaciones/${cotizacionId}/cambiar-estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "esperando_aprobacion" }),
      });
      const j1 = await r1.json();
      if (!r1.ok) {
        setError(j1.error || "No se pudo cambiar el estado");
        return;
      }
      const r2 = await fetch(`/api/cotizaciones/${cotizacionId}/reenviar-slack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j2 = await r2.json();
      if (!r2.ok) {
        setError(
          j2.error ||
            "El estado cambió, pero no se pudo enviar el mensaje a Slack. Usa \"Reenviar Slack\" abajo."
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="space-y-4">
      <div
        className="card"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-heading-2">Etapa temprana</h2>
          <span className="badge badge-warning">Aún no enviada a aprobación</span>
        </div>

        {iaRecomendacion ? (
          <div className="mb-4">
            <div className="text-overline text-text-tertiary mb-2">
              Recomendación IA
            </div>
            <Markdown text={iaRecomendacion} className="text-body text-text-primary" />
          </div>
        ) : (
          <p className="text-body text-text-secondary mb-4">
            Claude puede limpiar el texto de las tareas, sugerir si las horas
            son adecuadas y generar borradores para Sherlyn y para el
            cliente. Puedes editar las tareas antes o después de procesar.
          </p>
        )}

        {bufferPct > 0 && (
          <div
            className="rounded-[10px] p-3 mb-4 text-caption text-text-secondary"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
          >
            Con buffer (+{bufferPct}%): {conBuffer.totalMin}–{conBuffer.totalMax}h
            (PERT {conBuffer.totalEsperado}h)
          </div>
        )}

        {error && (
          <p className="text-caption mb-3" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={procesar}
            disabled={procesando || tareasCount === 0}
            className={iaRecomendacion ? "btn-secondary" : "btn-primary"}
            title={tareasCount === 0 ? "Agrega tareas primero" : undefined}
          >
            {iaRecomendacion ? (
              <RefreshCcw size={16} strokeWidth={1.75} />
            ) : (
              <Sparkles size={16} strokeWidth={1.75} />
            )}
            <span>
              {procesando
                ? "Procesando…"
                : iaRecomendacion
                ? "Reprocesar con IA"
                : "Procesar con IA"}
            </span>
          </button>

          <button
            type="button"
            onClick={enviarAAprobacion}
            disabled={enviando || !iaRecomendacion}
            className="btn-primary"
            title={
              !iaRecomendacion
                ? "Procesa con IA antes de enviar a aprobación"
                : undefined
            }
          >
            <ArrowRight size={16} strokeWidth={1.75} />
            <span>{enviando ? "Enviando…" : "Enviar a aprobación"}</span>
          </button>
        </div>
      </div>

      <BufferEditor
        savePath={`/api/cotizaciones/${cotizacionId}/buffer`}
        valorInicial={bufferPct}
      />
    </section>
  );
}
