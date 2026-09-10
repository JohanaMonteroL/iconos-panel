"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export default function FiltroProyectos({ actual }: { actual: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(actual ?? "");

  useEffect(() => {
    if ((q ?? "") === (actual ?? "")) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      const qs = next.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="input flex items-center gap-2" style={{ padding: "0 12px", maxWidth: 360 }}>
      <Search size={14} strokeWidth={1.75} className="text-text-tertiary" />
      <input
        className="flex-1 bg-transparent outline-none border-0"
        placeholder="Buscar por nombre…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Limpiar búsqueda"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
