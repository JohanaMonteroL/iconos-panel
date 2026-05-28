"use client";

import { useState } from "react";
import { Sparkles, FileText } from "lucide-react";

type Tarea = {
  nombre: string;
  descripcion: string;
  hrs_min: number;
  hrs_max: number;
};

export default function ToggleOriginalLimpia({
  limpia,
  original,
  nombreOriginal,
  nombreLimpio,
  labelLimpia = "Limpia (IA)",
}: {
  limpia: Tarea[];
  original: Tarea[];
  nombreOriginal: string;
  nombreLimpio: string;
  labelLimpia?: string;
}) {
  const [verOriginal, setVerOriginal] = useState(false);
  const tareas = verOriginal ? original : limpia;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVerOriginal(false)}
          className={`btn-sm ${!verOriginal ? "btn-primary" : "btn-secondary"}`}
        >
          <Sparkles size={12} strokeWidth={1.75} />
          <span>{labelLimpia}</span>
        </button>
        <button
          type="button"
          onClick={() => setVerOriginal(true)}
          className={`btn-sm ${verOriginal ? "btn-primary" : "btn-secondary"}`}
        >
          <FileText size={12} strokeWidth={1.75} />
          <span>Original (lo que escribí)</span>
        </button>
      </div>

      {verOriginal && nombreOriginal !== nombreLimpio && (
        <p className="text-caption text-text-tertiary mt-2 w-full">
          Nombre original: <em>{nombreOriginal}</em>
        </p>
      )}

      <ul className="space-y-3 w-full mt-3">
        {tareas.map((t, i) => (
          <li
            key={i}
            className="rounded-[12px] border overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div className="text-overline text-text-tertiary">
                Tarea {i + 1}
              </div>
              <span className="text-caption text-text-tertiary num-tabular">
                {t.hrs_min}–{t.hrs_max}h
              </span>
            </div>
            <div className="p-5 space-y-2">
              <div className="text-body-medium">{t.nombre}</div>
              {t.descripcion && (
                <p className="text-body text-text-secondary whitespace-pre-wrap">
                  {t.descripcion}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
