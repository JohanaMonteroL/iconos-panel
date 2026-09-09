"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileEdit, CheckCheck } from "lucide-react";
import { aplicarBuffer, totalesPERT } from "@/lib/pert";

type Props = {
  cotizacionId: string;
  bufferPct: number;
  horasMin: number;
  horasMax: number;
};

/**
 * Panel de "etapa temprana" — visible mientras la cotización está en
 * por_estimar / pendiente_revision_interna. Acciones para arrancar el flujo
 * de aprobación (o saltárselo) + el editor de buffer. El procesado con IA y
 * las tareas viven en CotizacionEditor (sección Tareas), más abajo.
 */
export default function EtapaTempranaPanel({
  cotizacionId,
  bufferPct,
  horasMin,
  horasMax,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"enviar" | "aprobada" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totales = useMemo(
    () => totalesPERT([{ hrs_min: horasMin, hrs_max: horasMax }]),
    [horasMin, horasMax]
  );
  const conBuffer = useMemo(
    () => aplicarBuffer(totales, bufferPct),
    [totales, bufferPct]
  );

  const cambiarAEsperandoAprobacion = async () => {
    const r = await fetch(`/api/cotizaciones/${cotizacionId}/cambiar-estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "esperando_aprobacion" }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "No se pudo cambiar el estado");
  };

  const enviarAAprobacion = async () => {
    setLoading("enviar");
    setError(null);
    try {
      await cambiarAEsperandoAprobacion();
      const r2 = await fetch(`/api/cotizaciones/${cotizacionId}/reenviar-slack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j2 = await r2.json();
      if (!r2.ok) {
        setError(
          j2.error ||
            'El estado cambió, pero no se pudo enviar el mensaje a Slack. Usa "Reenviar Slack" en Acciones.'
        );
        return;
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Error de red");
    } finally {
      setLoading(null);
    }
  };

  const crearComoAprobada = async () => {
    setLoading("aprobada");
    setError(null);
    try {
      await cambiarAEsperandoAprobacion();
      const r2 = await fetch(`/api/cotizaciones/${cotizacionId}/aprobar-interno`, {
        method: "POST",
      });
      const j2 = await r2.json();
      if (!r2.ok) {
        setError(j2.error || "No se pudo marcar el visto bueno interno");
        return;
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Error de red");
    } finally {
      setLoading(null);
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
            onClick={enviarAAprobacion}
            disabled={loading !== null}
            className="btn-primary"
          >
            <ArrowRight size={16} strokeWidth={1.75} />
            <span>{loading === "enviar" ? "Enviando…" : "Enviar a aprobación"}</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/panel/cotizaciones")}
            disabled={loading !== null}
            className="btn-secondary"
          >
            <FileEdit size={16} strokeWidth={1.75} />
            <span>Solo guardar como borrador</span>
          </button>
          <button
            type="button"
            onClick={crearComoAprobada}
            disabled={loading !== null}
            className="btn-ghost"
            title="Salta la notificación de Slack — la marca como si Iván ya la hubiera aprobado."
          >
            <CheckCheck size={16} strokeWidth={1.75} />
            <span>{loading === "aprobada" ? "Marcando…" : "Crear directamente como Aprobada"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
