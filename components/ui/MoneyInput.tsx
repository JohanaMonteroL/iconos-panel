"use client";

// Input de dinero — mientras escribes ves el número plano (fácil de editar);
// al salir del campo se muestra formateado "$2,000.00" (o "US$2,000.00" si
// `prefix="US$"`, para los montos en dólares de Cobros/Proyectos). El valor
// que maneja el formulario siempre es un string numérico limpio (sin "$" ni
// comas), listo para Number(valor).

import { useState } from "react";

function formatear(raw: string, prefix: string): string {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return "";
  return `${prefix}${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function limpiar(v: string): string {
  let s = v.replace(/[^\d.]/g, "");
  const partes = s.split(".");
  if (partes.length > 2) s = partes[0] + "." + partes.slice(1).join("");
  return s;
}

export default function MoneyInput({
  value,
  onChange,
  placeholder,
  className = "input num-tabular",
  prefix = "$",
  disabled,
  autoFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** "$" (default) o "US$" para campos en dólares. */
  prefix?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={focused ? value : formatear(value, prefix)}
      placeholder={placeholder ?? `${prefix}0.00`}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(limpiar(e.target.value))}
    />
  );
}
