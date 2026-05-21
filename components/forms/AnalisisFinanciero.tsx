"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, Eye, EyeOff, Save, TrendingUp } from "lucide-react";

type Props = {
  // Endpoint para guardar el precio_venta_hora
  savePath: string;
  precioHoraInterno: number;
  precioVentaInicial: number | null;
  // Horas vigentes (con buffer ya aplicado si corresponde)
  horasMin: number;
  horasMax: number;
};

const LS_KEY = "iconos.analisisFinanciero.visible";

function fmtMoney(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function AnalisisFinanciero({
  savePath,
  precioHoraInterno,
  precioVentaInicial,
  horasMin,
  horasMax,
}: Props) {
  const [visible, setVisible] = useState(true);
  const [precioVenta, setPrecioVenta] = useState<string>(
    precioVentaInicial != null ? String(precioVentaInicial) : ""
  );
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(
    precioVentaInicial ?? null
  );

  // Si el prop cambia (p. ej. después de procesar con IA y router.refresh),
  // sincronizar para que el precio guardado no se "pierda" al remountar.
  useEffect(() => {
    if (precioVentaInicial != null && precioVentaInicial !== lastSaved) {
      setPrecioVenta(String(precioVentaInicial));
      setLastSaved(precioVentaInicial);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precioVentaInicial]);

  // Persistir visibilidad en localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v === "0") setVisible(false);
    } catch {}
  }, []);

  const toggleVisible = () => {
    setVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const precioVentaNum = Number(precioVenta) || 0;

  const calc = useMemo(() => {
    const costoMin = horasMin * precioHoraInterno;
    const costoMax = horasMax * precioHoraInterno;
    const ventaMin = horasMin * precioVentaNum;
    const ventaMax = horasMax * precioVentaNum;
    const ganMin = ventaMin - costoMin;
    const ganMax = ventaMax - costoMax;
    const margenMin = ventaMin > 0 ? (ganMin / ventaMin) * 100 : 0;
    const margenMax = ventaMax > 0 ? (ganMax / ventaMax) * 100 : 0;
    return {
      costoMin,
      costoMax,
      ventaMin,
      ventaMax,
      ganMin,
      ganMax,
      margenMin,
      margenMax,
    };
  }, [horasMin, horasMax, precioHoraInterno, precioVentaNum]);

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch(savePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precio_venta_hora: precioVentaNum }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo guardar");
        return;
      }
      setLastSaved(precioVentaNum);
      setDirty(false);
    } catch {
      setError("Error de red");
    } finally {
      setGuardando(false);
    }
  };

  if (!visible) {
    return (
      <button
        type="button"
        onClick={toggleVisible}
        className="btn-secondary btn-sm"
      >
        <Eye size={14} strokeWidth={1.75} />
        <span>Mostrar análisis financiero</span>
      </button>
    );
  }

  const tieneVenta = precioVentaNum > 0;

  return (
    <section
      className="rounded-[12px] overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <DollarSign size={16} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="text-heading-2">Análisis financiero</h2>
        </div>
        <button
          type="button"
          onClick={toggleVisible}
          className="btn-ghost btn-sm"
          title="Ocultar"
        >
          <EyeOff size={14} strokeWidth={1.75} />
          <span>Ocultar</span>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Inputs lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Costo por hora (interno)</label>
            <div
              className="flex items-center px-3 num-tabular"
              style={{
                height: 38,
                borderRadius: 10,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              {fmtMoney(precioHoraInterno)}
            </div>
            <span className="field-hint">Tomado del programador</span>
          </div>
          <div>
            <label className="field-label">Precio de venta por hora *</label>
            <div className="flex gap-2">
              <input
                className="input num-tabular"
                type="number"
                min={0}
                inputMode="numeric"
                value={precioVenta}
                onChange={(e) => {
                  setPrecioVenta(e.target.value);
                  setDirty(Number(e.target.value) !== (lastSaved ?? 0));
                }}
                placeholder="Ej. 500"
              />
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !dirty}
                className="btn-secondary btn-sm whitespace-nowrap"
                title="Guardar"
              >
                <Save size={14} strokeWidth={1.75} />
                <span>{guardando ? "…" : "Guardar"}</span>
              </button>
            </div>
            <span className="field-hint">Lo que le cobramos al cliente por hora</span>
          </div>
        </div>

        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}

        {/* Resumen comparativo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Costo interno */}
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="text-overline text-text-tertiary">Costo interno</div>
            <div className="text-caption text-text-secondary mb-2">
              Lo que nos cuesta
            </div>
            <div className="num-tabular" style={{ fontSize: 20, fontWeight: 700 }}>
              {fmtMoney(calc.costoMin)}
            </div>
            <div className="text-caption text-text-tertiary">
              a {fmtMoney(calc.costoMax)}
            </div>
          </div>

          {/* Precio al cliente */}
          <div
            className="rounded-[10px] p-4"
            style={{
              background: tieneVenta ? "var(--bg-overlay)" : "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              opacity: tieneVenta ? 1 : 0.5,
            }}
          >
            <div className="text-overline text-text-tertiary">Precio al cliente</div>
            <div className="text-caption text-text-secondary mb-2">
              Lo que cobramos
            </div>
            <div className="num-tabular" style={{ fontSize: 20, fontWeight: 700 }}>
              {tieneVenta ? fmtMoney(calc.ventaMin) : "—"}
            </div>
            <div className="text-caption text-text-tertiary">
              {tieneVenta ? `a ${fmtMoney(calc.ventaMax)}` : "Define precio/hora"}
            </div>
          </div>

          {/* Ganancia */}
          <div
            className="rounded-[10px] p-4"
            style={{
              background: tieneVenta
                ? calc.ganMin >= 0
                  ? "rgba(34,197,94,0.08)"
                  : "rgba(239,68,68,0.08)"
                : "var(--bg-surface)",
              border: `1px solid ${
                tieneVenta
                  ? calc.ganMin >= 0
                    ? "rgba(34,197,94,0.3)"
                    : "rgba(239,68,68,0.3)"
                  : "var(--border-subtle)"
              }`,
              opacity: tieneVenta ? 1 : 0.5,
            }}
          >
            <div
              className="text-overline flex items-center gap-1"
              style={{
                color: tieneVenta
                  ? calc.ganMin >= 0
                    ? "var(--state-success)"
                    : "var(--state-error)"
                  : "var(--text-tertiary)",
              }}
            >
              <TrendingUp size={12} strokeWidth={1.75} />
              <span>Ganancia</span>
            </div>
            <div className="text-caption text-text-secondary mb-2">
              {tieneVenta && calc.ventaMin > 0
                ? `Margen ${calc.margenMin.toFixed(0)}–${calc.margenMax.toFixed(0)}%`
                : "Precio – Costo"}
            </div>
            <div
              className="num-tabular"
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: tieneVenta
                  ? calc.ganMin >= 0
                    ? "var(--state-success)"
                    : "var(--state-error)"
                  : "var(--text-primary)",
              }}
            >
              {tieneVenta ? fmtMoney(calc.ganMin) : "—"}
            </div>
            <div className="text-caption text-text-tertiary">
              {tieneVenta ? `a ${fmtMoney(calc.ganMax)}` : ""}
            </div>
          </div>
        </div>

        <p className="text-caption text-text-tertiary">
          Cálculos sobre {horasMin}–{horasMax} h (horas {horasMin === horasMax ? "" : "con buffer "}vigentes).
        </p>
      </div>
    </section>
  );
}
