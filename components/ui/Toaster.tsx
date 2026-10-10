"use client";

// Dibuja las notificaciones de lib/toast.ts: entran con un rebote, la
// palomita se "dibuja", una barra fina muestra el tiempo restante y salen
// solas (o al hacer clic). Máximo 3 a la vez.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Info } from "lucide-react";
import { suscribirToasts, type Toast } from "@/lib/toast";

const SALIDA_MS = 180;
const MAX = 3;

const COLOR: Record<Toast["tipo"], string> = {
  exito: "var(--state-success)",
  error: "var(--state-error)",
  info: "var(--accent)",
};

export default function Toaster() {
  const [toasts, setToasts] = useState<(Toast & { saliendo?: boolean })[]>([]);

  useEffect(() => {
    return suscribirToasts((t) => {
      setToasts((prev) => [...prev, t].slice(-MAX));
      setTimeout(() => cerrar(t.id), t.duracion);
    });
  }, []);

  function cerrar(id: number) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), SALIDA_MS);
  }

  return (
    <div
      aria-live="polite"
      className="fixed z-[60] flex flex-col gap-2 items-end pointer-events-none"
      style={{ right: 16, bottom: 16, left: 16 }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => cerrar(t.id)}
          className={`toast-anim pointer-events-auto relative overflow-hidden flex items-center gap-2.5 text-left cursor-pointer ${t.saliendo ? "saliendo" : ""}`}
          style={{
            maxWidth: 380,
            padding: "11px 14px",
            borderRadius: 12,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-lg)",
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          <span
            className="grid place-items-center shrink-0"
            style={{ width: 22, height: 22, borderRadius: "50%", background: COLOR[t.tipo], color: "#fff" }}
          >
            {t.tipo === "exito" ? (
              <svg className="toast-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : t.tipo === "error" ? (
              <AlertCircle size={14} strokeWidth={2.4} />
            ) : (
              <Info size={14} strokeWidth={2.4} />
            )}
          </span>
          <span>{t.mensaje}</span>
          {t.accion && (
            <Link
              href={t.accion.href}
              onClick={(e) => {
                e.stopPropagation();
                cerrar(t.id);
              }}
              className="shrink-0 font-semibold hover:underline"
              style={{ color: "var(--accent)", marginLeft: 4 }}
            >
              {t.accion.texto} →
            </Link>
          )}
          <span
            className="toast-tiempo absolute left-0 bottom-0 h-[2px] w-full"
            style={{ background: COLOR[t.tipo], opacity: 0.5, animationDuration: `${t.duracion}ms` }}
          />
        </div>
      ))}
    </div>
  );
}
