"use client";

import { LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Vista = "lista" | "cuadricula";

export default function VistaToggle({ vista }: { vista: Vista }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(v: Vista) {
    const params = new URLSearchParams(sp.toString());
    if (v === "lista") params.delete("vista");
    else params.set("vista", v);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const baseStyle = {
    background: "var(--bg-overlay)",
  } as const;

  return (
    <div
      className="inline-flex gap-1 p-1 rounded-lg"
      style={baseStyle}
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
    </div>
  );
}
