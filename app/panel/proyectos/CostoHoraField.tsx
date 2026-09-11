"use client";

// Input compuesto: monto + moneda (MXN/USD) en el mismo control, para que
// el costo por hora de un proyecto siempre lleve su moneda pegada.

export type Moneda = "MXN" | "USD";

export default function CostoHoraField({
  valor,
  moneda,
  onValorChange,
  onMonedaChange,
  disabled = false,
  autoFocus = false,
}: {
  valor: string;
  moneda: Moneda;
  onValorChange: (v: string) => void;
  onMonedaChange: (m: Moneda) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="input flex items-center gap-2" style={{ padding: "0 4px 0 11px" }}>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        className="flex-1 bg-transparent outline-none border-0 num-tabular"
        value={valor}
        onChange={(e) => onValorChange(e.target.value)}
        placeholder="0.00"
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <div className="flex gap-0.5 p-0.5 rounded-[7px] flex-shrink-0" style={{ background: "var(--bg-overlay)" }}>
        {(["MXN", "USD"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMonedaChange(m)}
            disabled={disabled}
            className="text-caption"
            style={{
              padding: "3px 9px",
              borderRadius: 6,
              fontWeight: 600,
              background: moneda === m ? "var(--bg-elevated)" : "transparent",
              color: moneda === m ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: moneda === m ? "var(--shadow-sm)" : "none",
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
