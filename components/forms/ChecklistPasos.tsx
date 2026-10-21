"use client";

// Checklist propia de "cómo hacer este pago" — pasos libres que Johana
// escribe una vez (ej. "entrar a banca en línea", "ir a pagos de
// servicios", "capturar la referencia") y va marcando cada vez que paga.
// Vive en el detalle del Pago, no en la lista.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import type { PasoPago } from "@/types/db";

export default function ChecklistPasos({ pagoId, pasos }: { pagoId: string; pasos: PasoPago[] }) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState("");
  const [sending, setSending] = useState(false);

  const guardar = async (next: PasoPago[]) => {
    setSending(true);
    try {
      const res = await fetch(`/api/pagos/${pagoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasos: next }),
      });
      if (!res.ok) {
        toast("No se pudo guardar", { tipo: "error" });
        return;
      }
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  const agregar = () => {
    const texto = nuevo.trim();
    if (!texto) return;
    setNuevo("");
    guardar([...pasos, { id: crypto.randomUUID(), texto, hecho: false }]);
  };

  const toggle = (id: string) => {
    guardar(pasos.map((p) => (p.id === id ? { ...p, hecho: !p.hecho } : p)));
  };

  const quitar = (id: string) => {
    guardar(pasos.filter((p) => p.id !== id));
  };

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-heading-2">Pasos para realizar el pago</h2>
        <p className="text-caption text-text-secondary mt-0.5">
          Tu propia guía — instrucciones paso a paso, márcalas conforme las haces.
        </p>
      </div>

      {pasos.length === 0 ? (
        <p className="text-caption text-text-tertiary">Sin pasos todavía.</p>
      ) : (
        <ul className="space-y-1.5">
          {pasos.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 group">
              <button
                type="button"
                onClick={() => toggle(p.id)}
                disabled={sending}
                aria-pressed={p.hecho}
                aria-label={p.hecho ? "Marcado — quitar" : "Marcar como hecho"}
                className="flex-shrink-0 grid place-items-center"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  border: `1.5px solid ${p.hecho ? "var(--state-success)" : "var(--border-default)"}`,
                  background: p.hecho ? "var(--state-success)" : "transparent",
                }}
              >
                {p.hecho && <Check size={13} strokeWidth={3} color="white" />}
              </button>
              <span className={`text-body flex-1 ${p.hecho ? "text-text-tertiary line-through" : ""}`}>
                {p.texto}
              </span>
              <button
                type="button"
                onClick={() => quitar(p.id)}
                disabled={sending}
                className="btn-icon btn-ghost opacity-0 group-hover:opacity-100 flex-shrink-0"
                aria-label="Quitar paso"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <input
          className="input flex-1"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Agregar paso…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
        />
        <button type="button" onClick={agregar} disabled={sending} className="btn-secondary btn-sm whitespace-nowrap">
          <Plus size={14} strokeWidth={1.75} />
          <span>Agregar</span>
        </button>
      </div>
    </div>
  );
}
