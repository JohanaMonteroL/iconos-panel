"use client";

// Tablero kanban con drag & drop: arrastrar una tarjeta a otra columna
// llama al mismo endpoint que ya usa el detalle de la cotización
// (/api/cotizaciones/[id]/cambiar-estado) para cambiar `estado`.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, DollarSign } from "lucide-react";
import { labelEstado, badgeEstado } from "@/lib/estados";
import { formatFechaCorta as fmtFecha } from "@/lib/dates";

type Row = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  created_at: string;
  programador_id: string | null;
  programadores: { nombre: string } | null;
  proyecto_nombre?: string | null;
  tipo_precio?: string | null;
  monto_fijo?: number | null;
};

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Color del punto de la columna, derivado de la misma clasificación que ya
// usan los badges de estado (ver lib/estados) — sin inventar una paleta nueva.
function dotColorForEstado(estado: string): string {
  switch (badgeEstado(estado)) {
    case "badge-success":
      return "#16A34A";
    case "badge-warning":
      return "#B45309";
    case "badge-danger":
      return "#DC2626";
    case "badge-info":
      return "#1D4ED8";
    default:
      return "#A1A1AA";
  }
}

const AVATAR_COLORS = [
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#FCE7F3", fg: "#BE185D" },
  { bg: "#EDE9FE", fg: "#6D28D9" },
];

function avatarColor(nombre: string) {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return "—";
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

// La API bloquea llegar a "enviada" por este camino: ese estado exige subir
// antes el PDF que se mandó al cliente (flujo aparte). Lo reflejamos aquí
// para no dejar caer la tarjeta y luego revertirla con un error confuso.
const ESTADOS_NO_ARRASTRABLES = new Set(["enviada"]);

export default function TableroCotizaciones({
  columnas,
  itemsIniciales,
  coloresProyecto = {},
}: {
  columnas: string[];
  itemsIniciales: Row[];
  coloresProyecto?: Record<string, string>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(itemsIniciales);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overEstado, setOverEstado] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const porEstado = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const e of columnas) map.set(e, []);
    for (const it of items) {
      if (!map.has(it.estado)) map.set(it.estado, []);
      map.get(it.estado)!.push(it);
    }
    return map;
  }, [items, columnas]);

  async function moverA(id: string, nuevoEstado: string) {
    const actual = items.find((it) => it.id === id);
    if (!actual || actual.estado === nuevoEstado) return;

    if (ESTADOS_NO_ARRASTRABLES.has(nuevoEstado)) {
      setError(
        `Para marcar "${labelEstado(nuevoEstado)}" primero sube el PDF que se mandó al cliente, desde el detalle de la cotización.`
      );
      return;
    }

    setError(null);
    const estadoAnterior = actual.estado;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, estado: nuevoEstado } : it)));
    setPendingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch(`/api/cotizaciones/${id}/cambiar-estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, estado: estadoAnterior } : it)));
        setError(data?.error || "No se pudo cambiar el estado.");
        return;
      }
      router.refresh();
    } catch {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, estado: estadoAnterior } : it)));
      setError("No se pudo cambiar el estado (sin conexión).");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="rounded-[9px] border px-3 py-2 text-caption"
          style={{ borderColor: "#FEE2E2", background: "#FEF2F2", color: "#DC2626" }}
        >
          {error}{" "}
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-medium"
            style={{ textDecoration: "underline" }}
          >
            Entendido
          </button>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3.5" style={{ minWidth: "max-content" }}>
          {columnas.map((estado) => {
            const cards = porEstado.get(estado) ?? [];
            const totalFijoCol = cards
              .filter((it) => it.tipo_precio === "fijo" && it.monto_fijo != null)
              .reduce((acc, it) => acc + Number(it.monto_fijo), 0);
            const isOver = overEstado === estado;
            return (
              <div
                key={estado}
                className="shrink-0 rounded-[14px] border p-[11px]"
                style={{
                  width: 268,
                  background: isOver ? "var(--bg-overlay)" : "var(--bg-surface)",
                  borderColor: isOver ? "var(--accent)" : "var(--border-subtle)",
                  transition: "background 120ms ease, border-color 120ms ease",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overEstado !== estado) setOverEstado(estado);
                }}
                onDragLeave={() => setOverEstado((cur) => (cur === estado ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverEstado(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moverA(id, estado);
                }}
              >
                <div className="flex items-center gap-2 px-[5px] pb-[11px]">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: dotColorForEstado(estado),
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-body-medium flex-1 truncate" style={{ fontSize: 13 }}>
                    {labelEstado(estado)}
                  </span>
                  <span className="text-caption text-text-tertiary num-tabular">{cards.length}</span>
                  {totalFijoCol > 0 && (
                    <span className="badge badge-neutral num-tabular">{fmtMxn(totalFijoCol)}</span>
                  )}
                </div>

                <div className="flex flex-col gap-[9px]">
                  {cards.length === 0 ? (
                    <div
                      className="rounded-[12px] p-4 text-caption text-text-tertiary text-center"
                      style={{ border: "1px dashed var(--border-default)" }}
                    >
                      Sin cotizaciones
                    </div>
                  ) : (
                    cards.map((it) => (
                      <TarjetaCotizacion
                        key={it.id}
                        it={it}
                        colorProyecto={it.proyecto_nombre ? coloresProyecto[it.proyecto_nombre.trim().toLowerCase()] : undefined}
                        dragging={dragId === it.id}
                        pending={pendingIds.has(it.id)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", it.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(it.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverEstado(null);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TarjetaCotizacion({
  it,
  colorProyecto,
  dragging,
  pending,
  onDragStart,
  onDragEnd,
}: {
  it: Row;
  colorProyecto?: string;
  dragging: boolean;
  pending: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const fijo = it.tipo_precio === "fijo";
  const dev = it.programadores?.nombre ?? null;
  const color = avatarColor(dev ?? it.id);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="relative rounded-[12px] border p-3"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-sm)",
        cursor: pending ? "wait" : "grab",
        opacity: dragging || pending ? 0.5 : 1,
        transition: "box-shadow 180ms ease, transform 180ms ease, opacity 120ms ease",
      }}
    >
      <Link href={`/panel/cotizaciones/${it.id}`} className="block space-y-0" draggable={false}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-body-medium break-words flex-1 min-w-0" style={{ fontSize: 13, lineHeight: 1.35 }}>
            {it.nombre}
          </span>
          <span className="badge badge-neutral shrink-0" style={{ fontSize: 10 }}>
            {fijo ? "Fijo" : "Por horas"}
          </span>
        </div>

        {it.proyecto_nombre && (
          <div
            className="inline-flex items-center gap-1.5 text-caption"
            style={{ margin: "4px 0 10px", color: colorProyecto ?? "var(--text-tertiary)" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: colorProyecto ?? "var(--text-tertiary)",
                flexShrink: 0,
              }}
            />
            {it.proyecto_nombre}
          </div>
        )}

        <div className="flex items-center gap-3 text-caption" style={{ color: "var(--text-secondary)" }}>
          {fijo ? (
            <span className="num-tabular inline-flex items-center gap-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              <DollarSign size={12} strokeWidth={1.9} />
              {it.monto_fijo != null ? fmtMxn(Number(it.monto_fijo)) : "—"}
            </span>
          ) : (
            <span className="num-tabular inline-flex items-center gap-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              <Clock size={12} strokeWidth={1.9} />
              {it.horas_min}–{it.horas_max}h
            </span>
          )}
        </div>

        <div
          className="flex items-center justify-between"
          style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
        >
          <span className="flex items-center gap-1.5 text-caption" style={{ color: "var(--text-secondary)" }}>
            <span
              className="grid place-items-center"
              style={{
                width: 21,
                height: 21,
                borderRadius: "50%",
                background: color.bg,
                color: color.fg,
                fontSize: 9,
                fontWeight: 600,
              }}
            >
              {iniciales(dev)}
            </span>
            {dev ?? "Sin asignar"}
          </span>
          <span className="text-caption num-tabular" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
            {fmtFecha(it.created_at)}
          </span>
        </div>
      </Link>
    </div>
  );
}
