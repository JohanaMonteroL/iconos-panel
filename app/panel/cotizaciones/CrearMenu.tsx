"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ChevronDown, Zap, ClipboardList } from "lucide-react";

/**
 * Botón "Crear" del listado de Cotizaciones: agrupa las dos formas de
 * arrancar un registro nuevo — cotización rápida (monto fijo) y estimación
 * (mismo formulario de tareas/horas que usan los programadores, pero crea
 * directo en "Revisión interna" y te lleva al detalle en vez de la pantalla
 * de "enviada").
 */
export default function CrearMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-primary"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={16} strokeWidth={1.75} />
        <span>Crear</span>
        <ChevronDown size={14} strokeWidth={1.75} style={{ opacity: 0.8 }} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-2 rounded-[11px] border overflow-hidden"
          style={{
            minWidth: 240,
            background: "var(--bg-elevated)",
            borderColor: "var(--border-default)",
            boxShadow: "var(--shadow-md)",
          }}
          role="menu"
        >
          <Link
            href="/panel/cotizaciones/nueva"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-[var(--bg-surface)]"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
            role="menuitem"
          >
            <Zap size={16} strokeWidth={1.75} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-secondary)" }} />
            <span>
              <span className="text-body-medium block">Cotización rápida</span>
              <span className="text-caption text-text-tertiary block">
                Monto fijo — venta o servicio con conceptos
              </span>
            </span>
          </Link>
          <Link
            href="/panel/cotizaciones/nueva-estimacion"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-[var(--bg-surface)]"
            role="menuitem"
          >
            <ClipboardList size={16} strokeWidth={1.75} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-secondary)" }} />
            <span>
              <span className="text-body-medium block">Crear estimación</span>
              <span className="text-caption text-text-tertiary block">
                Tareas y horas — se crea en &quot;Revisión interna&quot;
              </span>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
