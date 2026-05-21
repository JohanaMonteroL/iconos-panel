"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${SIZES[size]} max-h-[90vh] flex flex-col rounded-[14px] outline-none`}
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
