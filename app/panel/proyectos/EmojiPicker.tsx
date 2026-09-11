"use client";

import { X } from "lucide-react";
import { EMOJIS_PROYECTO } from "@/lib/proyectos/emojis";

export default function EmojiPicker({
  valor,
  onChange,
  disabled = false,
}: {
  valor: string;
  onChange: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("")}
        disabled={disabled}
        title="Sin emoji"
        aria-label="Sin emoji"
        className="grid place-items-center flex-shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          border: "1px solid var(--border-default)",
          background: valor === "" ? "var(--bg-overlay)" : "transparent",
        }}
      >
        <X size={13} strokeWidth={1.75} className="text-text-tertiary" />
      </button>
      {EMOJIS_PROYECTO.map((e) => {
        const seleccionado = valor === e;
        return (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            disabled={disabled}
            aria-label={e}
            className="grid place-items-center flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              fontSize: 16,
              background: seleccionado ? "var(--bg-overlay)" : "transparent",
              boxShadow: seleccionado ? "0 0 0 2px var(--accent)" : "none",
            }}
          >
            {e}
          </button>
        );
      })}
    </div>
  );
}
