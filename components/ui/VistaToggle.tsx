"use client";

import { Columns3, LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type Vista = "lista" | "cuadricula" | "board";

type Props = {
  vista: Vista;
  // Algunas páginas (p. ej. la vista angosta de estimaciones) no tienen
  // tablero — por defecto se muestran los tres botones.
  conBoard?: boolean;
};

export default function VistaToggle({ vista, conBoard = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(v: Vista) {
    const params = new URLSearchParams(sp.toString());
    // "board" es la vista por defecto (sin ?vista= en la URL) en desktop.
    if (v === "board") params.delete("vista");
    else params.set("vista", v);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div
      className="segmented inline-flex gap-1 p-1 rounded-lg"
      role="group"
      aria-label="Cambiar vista"
    >
      <button
        type="button"
        onClick={() => set("lista")}
        className={`btn-sm ${vista === "lista" ? "btn-primary" : "btn-ghost"}`}
        aria-pressed={vista === "lista"}
        title="Vista lista"
      >
        <List size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => set("cuadricula")}
        className={`btn-sm ${vista === "cuadricula" ? "btn-primary" : "btn-ghost"}`}
        aria-pressed={vista === "cuadricula"}
        title="Vista cuadrícula"
      >
        <LayoutGrid size={14} strokeWidth={1.75} />
      </button>
      {conBoard && (
        <button
          type="button"
          onClick={() => set("board")}
          className={`btn-sm ${vista === "board" ? "btn-primary" : "btn-ghost"}`}
          aria-pressed={vista === "board"}
          title="Vista tablero"
        >
          <Columns3 size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
