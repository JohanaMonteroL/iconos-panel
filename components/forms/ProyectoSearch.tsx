"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, X } from "lucide-react";

type Proyecto = { id: string; nombre: string };

type Props = {
  proyectos: Proyecto[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

export default function ProyectoSearch({ proyectos, value, onChange, disabled }: Props) {
  const seleccionado = useMemo(
    () => proyectos.find((p) => p.id === value) ?? null,
    [proyectos, value]
  );

  const ordenados = useMemo(
    () =>
      [...proyectos].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
      ),
    [proyectos]
  );

  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [activo, setActivo] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordenados;
    return ordenados.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [ordenados, query]);

  useEffect(() => {
    setActivo(0);
  }, [query, abierto]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const elegir = (p: Proyecto) => {
    onChange(p.id);
    setQuery("");
    setAbierto(false);
  };

  const limpiar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setAbierto(true);
    inputRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.min(filtrados.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const elegida = filtrados[activo];
      if (elegida) elegir(elegida);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="input flex items-center gap-2"
        style={{
          padding: "0 12px",
          cursor: disabled ? "not-allowed" : "text",
          opacity: disabled ? 0.6 : 1,
        }}
        onClick={() => {
          if (disabled) return;
          setAbierto(true);
          inputRef.current?.focus();
        }}
      >
        <Search size={14} strokeWidth={1.75} className="text-text-tertiary shrink-0" />
        <div className="relative flex-1" style={{ minWidth: 0 }}>
          {seleccionado && query === "" && (
            <span
              className="absolute inset-0 flex items-center pointer-events-none truncate text-body"
              style={{ color: "var(--text-primary)" }}
            >
              {seleccionado.nombre}
            </span>
          )}
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none border-0 py-0"
            style={{ minWidth: 0, height: "100%" }}
            placeholder={
              disabled ? "—" : seleccionado ? "" : "Busca un proyecto…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onKeyDown={onKey}
            disabled={disabled}
          />
        </div>
        {seleccionado && !disabled && (
          <button
            type="button"
            onClick={limpiar}
            aria-label="Limpiar selección"
            className="text-text-tertiary hover:text-text-primary shrink-0"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {abierto && !disabled && (
        <div
          className="absolute z-20 mt-1 w-full rounded-[10px] border overflow-hidden"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border-default)",
            boxShadow: "var(--shadow-md)",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {filtrados.length === 0 ? (
            <div className="px-4 py-3 text-caption text-text-tertiary">
              Sin resultados para “{query}”
            </div>
          ) : (
            <ul className="py-1">
              {filtrados.map((p, i) => {
                const esActivo = i === activo;
                const esSeleccionado = p.id === value;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActivo(i)}
                      onClick={() => elegir(p)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-body"
                      style={{
                        background: esActivo ? "var(--bg-surface)" : "transparent",
                        color: "var(--text-primary)",
                      }}
                    >
                      <span className="truncate">{p.nombre}</span>
                      {esSeleccionado && (
                        <Check size={14} strokeWidth={1.75} className="text-text-secondary shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
