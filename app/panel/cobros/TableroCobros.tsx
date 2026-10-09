"use client";

// Tablero kanban con drag & drop: arrastrar una tarjeta a otra columna
// llama a /api/cobros/periodos/[id]/cambiar-estado, y soltarla más arriba
// o más abajo guarda su posición en el carril (/reordenar). La lógica de
// arrastre se comparte con TableroCotizaciones.tsx en
// lib/tableros/useTableroKanban.ts.

import Link from "next/link";
import { useTableroKanban } from "@/lib/tableros/useTableroKanban";
import LineaInsercion from "@/components/ui/LineaInsercion";
import { labelEstadoPeriodo, colorHexEstadoPeriodo, labelOrigenCobro } from "@/lib/estados/cobros";
import { formatFechaCorta as fmtFecha } from "@/lib/dates";
import { textoContrastante } from "@/lib/proyectos/colores";
import { estadoFactura } from "@/lib/cobros/calculos";
import { FileCheck2, FileWarning, ExternalLink } from "lucide-react";

type Row = {
  id: string;
  estado: string;
  etiqueta: string;
  monto: number;
  moneda: string;
  created_at: string;
  cobro_id: string;
  origen: string;
  titulo: string;
  proyecto_id: string | null;
  cotizacion_id: string | null;
  factura_pdf_path: string | null;
  factura_xml_path: string | null;
};

function fmtMonto(n: number, moneda: string): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function TableroCobros({
  columnas,
  itemsIniciales,
  coloresProyecto = {},
  emojisProyecto = {},
  nombresProyecto = {},
  reordenable = true,
}: {
  columnas: string[];
  itemsIniciales: Row[];
  coloresProyecto?: Record<string, string>;
  emojisProyecto?: Record<string, string>;
  nombresProyecto?: Record<string, string>;
  // false cuando hay un "Ordenar por" activo: el orden manual no aplica.
  reordenable?: boolean;
}) {
  const { porEstado, error, setError, carrilActivo, propsCarril, propsTarjeta, lineaEn } = useTableroKanban({
    columnas,
    itemsIniciales,
    rutaApi: (id) => `/api/cobros/periodos/${id}`,
    reordenable,
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
            const totalColumna = cards.reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
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
                      background: colorHexEstadoPeriodo(estado),
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-body-medium flex-1 truncate" style={{ fontSize: 13 }}>
                    {labelEstadoPeriodo(estado)}
                  </span>
                  <span className="text-caption text-text-tertiary num-tabular">{cards.length}</span>
                  {totalColumna > 0 && (
                    <span className="badge badge-neutral num-tabular">{fmtMonto(totalColumna, "MXN")}</span>
                  )}
                </div>

                <div className="flex flex-col gap-[9px]">
                  {cards.length === 0 ? (
                    <div
                      className="rounded-[12px] p-4 text-caption text-text-tertiary text-center"
                      style={{ border: "1px dashed var(--border-default)" }}
                    >
                      Sin períodos
                    </div>
                  ) : (
                    cards.map((it) => (
                      <TarjetaPeriodo
                        key={it.id}
                        it={it}
                        colorProyecto={it.proyecto_id ? coloresProyecto[it.proyecto_id] : undefined}
                        emojiProyecto={it.proyecto_id ? emojisProyecto[it.proyecto_id] : undefined}
                        nombreProyecto={it.proyecto_id ? nombresProyecto[it.proyecto_id] : undefined}
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

function TarjetaPeriodo({
  it,
  colorProyecto,
  emojiProyecto,
  nombreProyecto,
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
  nombreProyecto?: string;
  dragging: boolean;
  pending: boolean;
  linea: "arriba" | "abajo" | null;
  "data-tarjeta-id": string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const factura = estadoFactura(it);

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
      <Link href={`/panel/cobros/${it.id}`} className="block space-y-0" draggable={false}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-body-medium break-words flex-1 min-w-0" style={{ fontSize: 15, lineHeight: 1.35 }}>
            {it.etiqueta}
          </span>
          <span
            className="badge shrink-0"
            style={{
              fontSize: 10,
              background: it.origen === "soporte" ? "#CCFBF1" : "#E0E7FF",
              color: it.origen === "soporte" ? "#0D9488" : "#4F46E5",
            }}
          >
            {labelOrigenCobro(it.origen)}
          </span>
        </div>

        <p className="text-caption text-text-tertiary truncate" style={{ margin: "2px 0 8px" }}>
          {it.titulo}
        </p>

        {nombreProyecto && (
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
              {nombreProyecto}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
          <span className="num-tabular" style={{ fontWeight: 600, fontSize: 17, color: "var(--text-primary)" }}>
            {fmtMonto(Number(it.monto) || 0, it.moneda)}
          </span>
        </div>

        <div
          className="flex items-center justify-between"
          style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
        >
          <span className="flex items-center gap-1.5 text-caption" style={{ color: "var(--text-secondary)" }}>
            {factura === "completa" ? (
              <FileCheck2 size={13} strokeWidth={1.75} style={{ color: "var(--state-success)" }} />
            ) : (
              <FileWarning size={13} strokeWidth={1.75} style={{ color: "var(--text-tertiary)" }} />
            )}
            Factura: {factura}
          </span>
          <span className="text-caption num-tabular" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
            {fmtFecha(it.created_at)}
          </span>
        </div>
      </Link>

      {it.cotizacion_id && (
        <Link
          href={`/panel/cotizaciones/${it.cotizacion_id}`}
          className="inline-flex items-center gap-1 text-caption hover:underline"
          style={{ color: "var(--text-tertiary)", marginTop: 8 }}
        >
          <ExternalLink size={11} strokeWidth={1.75} />
          Cotización de origen
        </Link>
      )}
    </div>
  );
}
