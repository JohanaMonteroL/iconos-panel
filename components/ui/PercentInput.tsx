"use client";

// Input de porcentaje — mismo patrón que MoneyInput: número plano mientras
// escribes, formateado "16%" al salir del campo. Para el IVA (es una tasa,
// no un monto de dinero).

import { useState } from "react";

function formatear(raw: string): string {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return "";
  return `${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function limpiar(v: string): string {
  let s = v.replace(/[^\d.]/g, "");
  const partes = s.split(".");
  if (partes.length > 2) s = partes[0] + "." + partes.slice(1).join("");
  return s;
}

export default function PercentInput({
  value,
  onChange,
  placeholder = "0%",
  className = "input num-tabular",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={focused ? value : formatear(value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(limpiar(e.target.value))}
    />
  );
}
