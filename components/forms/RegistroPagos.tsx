"use client";

// Bitácora opcional de pagos ya ejecutados — distinta de la marca rápida de
// "pagado" (TogglePagado): esa es control del período actual, esto es
// historial para quien quiera conservarlo. Nunca es obligatorio llenarlo.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import MoneyInput from "@/components/ui/MoneyInput";
import { fmtMXN } from "@/lib/pagos/calculos";
import type { PagoRegistro } from "@/types/db";

function fmtFecha(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function RegistroPagos({
  pagoId,
  registros,
  totalAPagar,
}: {
  pagoId: string;
  registros: PagoRegistro[];
  totalAPagar: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [sending, setSending] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Por defecto el monto es el total a pagar del pago (lo más común: se paga
  // completo) — pero sigue siendo editable para parcialidades u otros casos.
  const abrirFormulario = () => {
    setMonto(totalAPagar > 0 ? String(totalAPagar) : "");
    setAgregando(true);
  };

  const agregar = async () => {
    setError(null);
    if (!fecha || !Number(monto)) {
      setError("Captura fecha y monto.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/pagos/${pagoId}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, monto: Number(monto), notas: notas.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      setMonto("");
      setNotas("");
      setAgregando(false);
      toast("Registro agregado");
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  const borrar = async (registroId: string) => {
    if (!confirm("¿Quitar este registro?")) return;
    const res = await fetch(`/api/pagos/${pagoId}/registros/${registroId}`, { method: "DELETE" });
    if (!res.ok) {
      toast("No se pudo borrar", { tipo: "error" });
      return;
    }
    router.refresh();
  };

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <div className="text-left">
          <h2 className="text-heading-2">Registro de pagos</h2>
          <p className="text-caption text-text-secondary mt-0.5">
            Historial opcional — llévalo solo si te sirve, no hace falta para nada más.
          </p>
        </div>
        {abierto ? <ChevronUp size={18} strokeWidth={1.75} /> : <ChevronDown size={18} strokeWidth={1.75} />}
      </button>

      {abierto && (
        <div className="mt-4 space-y-3">
          {registros.length === 0 && !agregando ? (
            <p className="text-caption text-text-tertiary">Sin registros todavía.</p>
          ) : (
            registros.length > 0 && (
              <ul className="space-y-2">
                {registros.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-[9px]"
                    style={{ background: "var(--bg-surface)" }}
                  >
                    <div className="min-w-0">
                      <span className="text-body-medium num-tabular">{fmtMXN(r.monto)}</span>
                      <span className="text-caption text-text-tertiary ml-2">{fmtFecha(r.fecha)}</span>
                      {r.notas && <div className="text-caption text-text-tertiary mt-0.5 truncate">{r.notas}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => borrar(r.id)}
                      className="btn-icon btn-ghost flex-shrink-0"
                      aria-label="Quitar registro"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {agregando ? (
            <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border-faint)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Fecha</label>
                  <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Monto</label>
                  <MoneyInput value={monto} onChange={setMonto} />
                </div>
              </div>
              <div>
                <label className="field-label">Notas (opcional)</label>
                <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
              {error && (
                <p className="text-caption" style={{ color: "var(--state-error)" }}>
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={agregar} disabled={sending} className="btn-primary btn-sm">
                  {sending ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={() => setAgregando(false)} disabled={sending} className="btn-secondary btn-sm">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={abrirFormulario} className="btn-secondary btn-sm">
              <Plus size={14} strokeWidth={1.75} />
              <span>Agregar registro</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
