"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Save } from "lucide-react";

type Tipo = "min" | "pert" | "max" | "custom";

type Props = {
  cotizacionId: string;
  horasMin: number;
  horasMax: number;
  // Valor actualmente guardado (puede ser null si nunca se ajustó).
  horasEnvioActual: number | null;
};

export default function HorasEnvioCotizacion({
  cotizacionId,
  horasMin,
  horasMax,
  horasEnvioActual,
}: Props) {
  const router = useRouter();

  const pert = useMemo(
    () => Math.round(((horasMin + horasMax) / 2) * 10) / 10,
    [horasMin, horasMax]
  );

  // Inferir el tipo a partir del valor actual (best-effort).
  const tipoInicial: Tipo = (() => {
    const v = horasEnvioActual;
    if (v == null) return "pert";
    if (v === horasMin) return "min";
    if (v === horasMax) return "max";
    if (Math.abs(v - pert) < 0.05) return "pert";
    return "custom";
  })();

  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [custom, setCustom] = useState<string>(
    tipoInicial === "custom" && horasEnvioActual != null
      ? String(horasEnvioActual)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn" | "err"; texto: string } | null>(
    null
  );

  const horasEnvioCalc = useMemo(() => {
    if (tipo === "min") return horasMin;
    if (tipo === "max") return horasMax;
    if (tipo === "pert") return pert;
    const n = Number(custom);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
  }, [tipo, custom, horasMin, horasMax, pert]);

  const dirty = horasEnvioCalc !== (horasEnvioActual ?? pert);

  const guardar = async () => {
    if (tipo === "custom" && (!Number(custom) || Number(custom) <= 0)) {
      setMsg({ tipo: "err", texto: "Pon un número válido en personalizado." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/cotizaciones/${cotizacionId}/horas-envio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo,
            custom: tipo === "custom" ? Number(custom) : null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      if (json.clickup_warning) {
        setMsg({
          tipo: "warn",
          texto: `Guardado, pero ClickUp: ${json.clickup_warning}`,
        });
      } else {
        setMsg({
          tipo: "ok",
          texto: `Horas actualizadas a ${json.horas_envio}h y ClickUp sincronizado.`,
        });
        setTimeout(() => setMsg(null), 3500);
      }
      router.refresh();
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="rounded-[12px] overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="px-5 py-3 border-b flex items-center justify-between gap-2 flex-wrap"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="text-heading-2">Horas a enviar al jefe</h2>
        </div>
        <span className="text-caption text-text-secondary num-tabular">
          Actual:{" "}
          <strong className="text-text-primary font-semibold">
            {horasEnvioActual != null ? `${horasEnvioActual}h` : "—"}
          </strong>
        </span>
      </div>

      <div className="p-5 space-y-3">
        <p className="text-caption text-text-secondary">
          Elige qué número de horas aparece en el mensaje de Slack y en la
          descripción del ticket de ClickUp. No cambia las horas de las
          tareas — solo el total que ve el jefe / cliente.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {(["min", "pert", "max"] as Tipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`btn-sm whitespace-nowrap ${
                tipo === t ? "btn-primary" : "btn-secondary"
              }`}
            >
              {t === "min"
                ? `Mín · ${horasMin}h`
                : t === "pert"
                ? `PERT · ${pert}h`
                : `Máx · ${horasMax}h`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTipo("custom")}
            className={`btn-sm whitespace-nowrap ${
              tipo === "custom" ? "btn-primary" : "btn-secondary"
            }`}
          >
            Personalizado
          </button>
          {tipo === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                className="input input-sm num-tabular text-center w-24"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="hrs"
              />
              <span className="text-caption text-text-secondary">horas</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-caption text-text-secondary num-tabular">
            Quedará en{" "}
            <strong className="text-text-primary font-semibold">
              {horasEnvioCalc}h
            </strong>
            .
          </div>
          <button
            type="button"
            onClick={guardar}
            disabled={saving || !dirty}
            className="btn-primary btn-sm"
          >
            <Save size={14} strokeWidth={1.75} />
            <span>{saving ? "Guardando…" : "Guardar horas"}</span>
          </button>
        </div>

        {msg && (
          <p
            className="text-caption"
            style={{
              color:
                msg.tipo === "ok"
                  ? "var(--state-success)"
                  : msg.tipo === "warn"
                  ? "var(--state-warning)"
                  : "var(--state-error)",
            }}
          >
            {msg.tipo === "ok" ? "✓" : "⚠"} {msg.texto}
          </p>
        )}
      </div>
    </section>
  );
}
