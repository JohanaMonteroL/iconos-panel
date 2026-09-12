"use client";

// Buscador global del sidebar (⌘K / Ctrl+K) — busca en Proyectos,
// Cotizaciones y Cobros a la vez y navega al resultado elegido.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, Briefcase, DollarSign, Loader2 } from "lucide-react";
import { labelEstado, badgeEstado } from "@/lib/estados";
import { labelEstadoPeriodo, badgeEstadoPeriodo } from "@/lib/estados/cobros";
import type { ResultadoBusqueda } from "@/app/api/buscar/route";

const ICONO_TIPO: Record<ResultadoBusqueda["tipo"], typeof FileText> = {
  proyecto: Briefcase,
  cotizacion: FileText,
  cobro: DollarSign,
};

const LABEL_TIPO: Record<ResultadoBusqueda["tipo"], string> = {
  proyecto: "Proyecto",
  cotizacion: "Cotización",
  cobro: "Cobro",
};

function Trigger({
  collapsed,
  onOpen,
}: {
  collapsed?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 rounded-[11px] border cursor-pointer w-full text-left"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
        padding: "10px 11px",
        justifyContent: collapsed ? "center" : undefined,
        boxShadow: "var(--shadow-sm)",
      }}
      title="Buscar cliente, folio…"
    >
      <Search size={15} strokeWidth={2} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      {!collapsed && (
        <>
          <span className="text-caption text-text-tertiary flex-1 truncate">Buscar cliente, folio…</span>
          <span className="text-mono" style={{ fontSize: 10.5, color: "var(--text-disabled)" }}>
            ⌘K
          </span>
        </>
      )}
    </button>
  );
}

export default function BuscarGlobal({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqIdRef = useRef(0);

  const cerrar = useCallback(() => {
    setOpen(false);
    setQ("");
    setResultados([]);
    setActivo(0);
  }, []);

  // Atajo global ⌘K / Ctrl+K para abrir, sin importar en qué input esté el foco.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        cerrar();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cerrar]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResultados([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const miId = ++reqIdRef.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (miId !== reqIdRef.current) return; // respuesta vieja, ignorar
        setResultados(json.resultados ?? []);
        setActivo(0);
      } catch {
        if (miId === reqIdRef.current) setResultados([]);
      } finally {
        if (miId === reqIdRef.current) setCargando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const ir = (r: ResultadoBusqueda) => {
    cerrar();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resultados[activo]) ir(resultados[activo]);
    }
  };

  return (
    <>
      <Trigger collapsed={collapsed} onOpen={() => setOpen(true)} />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-[12vh]"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={cerrar}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[14px] overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              className="flex items-center gap-2.5 px-4 border-b"
              style={{ borderColor: "var(--border-subtle)", height: 52 }}
            >
              <Search size={16} strokeWidth={2} style={{ color: "var(--text-tertiary)" }} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar proyecto, cotización o cobro…"
                className="flex-1 bg-transparent outline-none border-0 text-body"
                style={{ color: "var(--text-primary)" }}
              />
              {cargando && <Loader2 size={15} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />}
              <button
                type="button"
                onClick={cerrar}
                className="btn-icon btn-ghost"
                style={{ width: 26, height: 26 }}
                aria-label="Cerrar"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="text-caption text-text-tertiary text-center py-8">
                  Escribe al menos 2 letras para buscar.
                </p>
              ) : !cargando && resultados.length === 0 ? (
                <p className="text-caption text-text-tertiary text-center py-8">
                  Sin resultados para &quot;{q.trim()}&quot;.
                </p>
              ) : (
                <ul className="p-1.5">
                  {resultados.map((r, i) => {
                    const Icono = ICONO_TIPO[r.tipo];
                    const esActivo = i === activo;
                    return (
                      <li key={`${r.tipo}-${r.id}`}>
                        <button
                          type="button"
                          onClick={() => ir(r)}
                          onMouseEnter={() => setActivo(i)}
                          className="w-full flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-left"
                          style={{ background: esActivo ? "var(--bg-overlay)" : "transparent" }}
                        >
                          <span
                            className="grid place-items-center flex-shrink-0"
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: "var(--bg-surface)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {r.meta?.emoji ? (
                              <span style={{ fontSize: 14 }}>{r.meta.emoji}</span>
                            ) : (
                              <Icono size={14} strokeWidth={1.75} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-body-medium truncate">{r.titulo}</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-caption text-text-tertiary truncate">
                              {LABEL_TIPO[r.tipo]}
                              {r.subtitulo && <>· {r.subtitulo}</>}
                            </span>
                          </span>
                          {r.meta?.estado && (
                            <span
                              className={`badge shrink-0 ${
                                r.tipo === "cobro" ? badgeEstadoPeriodo(r.meta.estado) : badgeEstado(r.meta.estado)
                              }`}
                            >
                              {r.tipo === "cobro" ? labelEstadoPeriodo(r.meta.estado) : labelEstado(r.meta.estado)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
