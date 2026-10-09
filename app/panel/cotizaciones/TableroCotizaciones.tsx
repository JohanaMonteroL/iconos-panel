"use client";

// Tablero kanban con drag & drop: arrastrar una tarjeta a otra columna
// llama al mismo endpoint que ya usa el detalle de la cotización
// (/api/cotizaciones/[id]/cambiar-estado) para cambiar `estado`, y soltarla
// más arriba o más abajo guarda su posición en el carril (/reordenar).
// Lógica de arrastre compartida en lib/tableros/useTableroKanban.ts.

import Link from "next/link";
import { useTableroKanban } from "@/lib/tableros/useTableroKanban";
import LineaInsercion from "@/components/ui/LineaInsercion";
import { labelEstado, colorHexEstado } from "@/lib/estados";
import { formatFechaCorta as fmtFecha } from "@/lib/dates";
import { textoContrastante } from "@/lib/proyectos/colores";
import { montoCotizacion } from "@/lib/cotizaciones/calculos";

type Row = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  horas_envio?: number | null;
  precio_venta_hora?: number | null;
  created_at: string;
  programador_id: string | null;
  programadores: { nombre: string } | null;
  proyecto_nombre?: string | null;
  proyecto_clickup_id?: string | null;
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
  emojisProyecto = {},
  precioHoraVentaProyecto = {},
  reordenable = true,
}: {
  columnas: string[];
  itemsIniciales: Row[];
  coloresProyecto?: Record<string, string>;
  emojisProyecto?: Record<string, string>;
  precioHoraVentaProyecto?: Record<string, number>;
  // false cuando hay un "Ordenar por" activo: el orden manual no aplica.
  reordenable?: boolean;
}) {
  const { porEstado, error, setError, carrilActivo, propsCarril, propsTarjeta, lineaEn } = useTableroKanban({
    columnas,
    itemsIniciales,
    rutaApi: (id) => `/api/cotizaciones/${id}`,
    reordenable,
    validarDestino: (estado) =>
      ESTADOS_NO_ARRASTRABLES.has(estado)
        ? `Para marcar "${labelEstado(estado)}" primero sube el PDF que se mandó al cliente, desde el detalle de la cotización.`
        : null,
  });

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
            const totalColumna = cards.reduce(
              (acc, it) =>
                acc +
                (montoCotizacion(
                  it,
                  it.proyecto_clickup_id ? precioHoraVentaProyecto[it.proyecto_clickup_id] : undefined
                ) ?? 0),
              0
            );
            const isOver = carrilActivo === estado;
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
                {...propsCarril(estado)}
              >
                <div className="flex items-center gap-2 px-[5px] pb-[11px]">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: colorHexEstado(estado),
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-body-medium flex-1 truncate" style={{ fontSize: 13 }}>
                    {labelEstado(estado)}
                  </span>
                  <span className="text-caption text-text-tertiary num-tabular">{cards.length}</span>
                  {totalColumna > 0 && (
                    <span className="badge badge-neutral num-tabular">{fmtMxn(totalColumna)}</span>
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
                        colorProyecto={it.proyecto_clickup_id ? coloresProyecto[it.proyecto_clickup_id] : undefined}
                        emojiProyecto={it.proyecto_clickup_id ? emojisProyecto[it.proyecto_clickup_id] : undefined}
                        precioHoraVentaProyecto={
                          it.proyecto_clickup_id ? precioHoraVentaProyecto[it.proyecto_clickup_id] : undefined
                        }
                        {...propsTarjeta(it.id)}
                        linea={lineaEn(estado, it.id)}
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
  emojiProyecto,
  precioHoraVentaProyecto,
  dragging,
  pending,
  linea,
  onDragStart,
  onDragEnd,
  ...rest
}: {
  it: Row;
  colorProyecto?: string;
  emojiProyecto?: string;
  precioHoraVentaProyecto?: number;
  dragging: boolean;
  pending: boolean;
  linea: "arriba" | "abajo" | null;
  "data-tarjeta-id": string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const fijo = it.tipo_precio === "fijo";
  const dev = it.programadores?.nombre ?? null;
  const color = avatarColor(dev ?? it.id);
  const precioTotalTarjeta = montoCotizacion(it, precioHoraVentaProyecto);

  return (
    <div
      draggable
      data-tarjeta-id={rest["data-tarjeta-id"]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="kanban-card relative rounded-[12px] border p-3"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-sm)",
        cursor: pending ? "wait" : "grab",
        opacity: dragging || pending ? 0.5 : 1,
        transition: "box-shadow 180ms ease, transform 180ms ease, opacity 120ms ease",
      }}
    >
      {linea && <LineaInsercion posicion={linea} />}
      <Link href={`/panel/cotizaciones/${it.id}`} className="block space-y-0" draggable={false}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-body-medium break-words flex-1 min-w-0" style={{ fontSize: 15, lineHeight: 1.35 }}>
            {it.nombre}
          </span>
          <span className="badge badge-neutral shrink-0" style={{ fontSize: 10 }}>
            {fijo ? "Fijo" : "Por horas"}
          </span>
        </div>

        {it.proyecto_nombre && (
          <div style={{ margin: "4px 0 10px" }}>
            <span
              className="inline-block text-caption truncate"
              style={{
                maxWidth: "100%",
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 600,
                background: colorProyecto ?? "var(--bg-overlay)",
                color: colorProyecto ? textoContrastante(colorProyecto) : "var(--text-secondary)",
              }}
            >
              {emojiProyecto ? `${emojiProyecto} ` : ""}
              {it.proyecto_nombre}
            </span>
          </div>
        )}

        {precioTotalTarjeta != null && (
          <div className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
            <span className="num-tabular" style={{ fontWeight: 600, fontSize: 17, color: "var(--text-primary)" }}>
              {fmtMxn(precioTotalTarjeta)}
            </span>
          </div>
        )}

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
