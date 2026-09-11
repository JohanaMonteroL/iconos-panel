"use client";

import { Check } from "lucide-react";
import { COLORES_PROYECTO } from "@/lib/proyectos/colores";

export default function ColorPicker({
  valor,
  onChange,
  disabled = false,
}: {
  valor: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORES_PROYECTO.map((c) => {
        const seleccionado = valor.toLowerCase() === c.valor.toLowerCase();
        return (
          <button
            key={c.valor}
            type="button"
            onClick={() => onChange(c.valor)}
            disabled={disabled}
            title={c.nombre}
            aria-label={c.nombre}
            className="grid place-items-center flex-shrink-0"
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: c.valor,
              boxShadow: seleccionado ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${c.valor}` : "none",
            }}
          >
            {seleccionado && <Check size={13} strokeWidth={3} color="#fff" />}
          </button>
        );
      })}
    </div>
  );
}
