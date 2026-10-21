"use client";

// Botón de copiar reusable — mismo patrón que la copia de contraseña
// temporal en AdministradorRow.tsx (navigator.clipboard + ícono de check
// temporal), pero genérico para cualquier valor.

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={copiar}
      className="btn-icon btn-ghost flex-shrink-0"
      aria-label={label ? `Copiar ${label}` : "Copiar"}
      title={label ? `Copiar ${label}` : "Copiar"}
    >
      {copiado ? (
        <Check size={14} strokeWidth={2} style={{ color: "var(--state-success)" }} />
      ) : (
        <Copy size={14} strokeWidth={1.75} />
      )}
    </button>
  );
}
