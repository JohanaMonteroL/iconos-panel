"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Save } from "lucide-react";

type Props = {
  cotizacionId: string;
  montoActual: number | null;
};

/**
 * Editor inline del monto total de una cotización de tipo fijo.
 * Llama al endpoint /horas-envio reutilizándolo no — para no acoplarnos,
 * usamos /editar con un campo nuevo monto_fijo.
 */
export default function MontoFijoEditor({ cotizacionId, montoActual }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<string>(
    montoActual != null ? String(montoActual) : ""
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn" | "err"; texto: string } | null>(
    null
  );

  const numero = Number(value);
  const dirty = Number.isFinite(numero) && numero !== (montoActual ?? 0);

  const guardar = async () => {
    if (!Number.isFinite(numero) || numero <= 0) {
      setMsg({ tipo: "err", texto: "Monto inválido (> 0)" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto_fijo: numero }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      if (json.clickup_warning) {
        setMsg({ tipo: "warn", texto: `Guardado. ClickUp: ${json.clickup_warning}` });
      } else {
        setMsg({ tipo: "ok", texto: "Monto actualizado y ClickUp sincronizado" });
        setTimeout(() => setMsg(null), 2500);
      }
      router.refresh();
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSaving(false);
    }
  };

  const formatoActual =
    montoActual != null
      ? montoActual.toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : "—";

  return (
    <section
      className="rounded-[12px] overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <DollarSign size={16} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="text-heading-2">Monto total</h2>
        </div>
        <span className="text-caption text-text-secondary num-tabular">
          Actual:{" "}
          <strong className="text-text-primary font-semibold">{formatoActual}</strong>
        </span>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-caption text-text-secondary">
          Total que se le cobra al cliente por esta cotización. Cambiarlo
          regenera el mensaje de Slack y la descripción del ticket en
          ClickUp.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="input num-tabular"
            type="number"
            min={0}
            step={1}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            style={{ maxWidth: 200 }}
          />
          <span className="text-body text-text-secondary">MXN</span>
          <button
            type="button"
            onClick={guardar}
            disabled={saving || !dirty}
            className="btn-primary btn-sm ml-auto"
          >
            <Save size={14} strokeWidth={1.75} />
            <span>{saving ? "Guardando…" : "Guardar"}</span>
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
