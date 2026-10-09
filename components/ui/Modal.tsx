"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

// Debe coincidir con la duración de modal-*-out en globals.css.
const SALIDA_MS = 160;

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Se queda montado SALIDA_MS después de cerrar para animar la salida.
  const [montado, setMontado] = useState(open);
  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    if (open) {
      setMontado(true);
      setSaliendo(false);
      return;
    }
    if (!montado) return;
    setSaliendo(true);
    const t = setTimeout(() => {
      setMontado(false);
      setSaliendo(false);
    }, SALIDA_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mantener una ref estable al onClose para no re-ejecutar el efecto
  // cada vez que el padre re-renderiza (causaba que el modal robara el
  // foco del input al escribir cada letra).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Cerrar con Escape + bloquear scroll del body mientras está abierto.
  // Foco inicial al diálogo, pero solo al abrir (no en cada render).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!montado) return null;

  return (
    <div
      className={`modal-backdrop-anim fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${saliendo ? "saliendo" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={saliendo ? undefined : onClose}
      style={{ background: "rgba(0,0,0,0.45)", pointerEvents: saliendo ? "none" : undefined }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`modal-panel-anim w-full ${SIZES[size]} max-h-[90vh] flex flex-col rounded-[14px] outline-none`}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <h2 id="modal-title" className="text-heading-1">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="btn-icon btn-ghost"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
