// Vista de solo lectura: todas las facturas (PDF/XML) y comprobantes de
// pago de TODOS los períodos de un Cobro (el "padre"), para verlo completo
// sin importar desde qué parcialidad estás viendo el detalle. Subir/quitar
// factura de un período se sigue haciendo desde AdjuntoFactura, en
// CobroPeriodoTabs — esta vista es solo de consulta.

import { FileText, FileCode2, ExternalLink, Receipt, FolderOpen } from "lucide-react";
import { formatFechaCorta } from "@/lib/dates";
import { labelEstadoPeriodo, badgeEstadoPeriodo } from "@/lib/estados/cobros";

export type PeriodoDocumento = {
  periodoId: string;
  etiqueta: string;
  estado: string;
  esPeriodoActual: boolean;
  facturaPdfUrl: string | null;
  facturaPdfNombre: string | null;
  facturaXmlUrl: string | null;
  facturaXmlNombre: string | null;
  pagos: { id: string; monto: number; fecha: string; comprobanteUrl: string | null }[];
};

function fmtMonto(n: number, moneda: string = "MXN"): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Chip({
  icon: Icon,
  label,
  url,
  colorBg,
  colorFg,
}: {
  icon: typeof FileText;
  label: string;
  url: string | null;
  colorBg: string;
  colorFg: string;
}) {
  if (!url) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-caption rounded-[8px] px-2.5 py-1.5"
        style={{ background: "var(--bg-overlay)", color: "var(--text-tertiary)" }}
      >
        <Icon size={13} strokeWidth={1.75} />
        {label} sin cargar
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-caption rounded-[8px] px-2.5 py-1.5 hover:brightness-95 transition"
      style={{ background: colorBg, color: colorFg, fontWeight: 600 }}
    >
      <Icon size={13} strokeWidth={1.75} />
      {label}
      <ExternalLink size={11} strokeWidth={1.75} />
    </a>
  );
}

export default function DocumentosCobro({ periodos }: { periodos: PeriodoDocumento[] }) {
  const totalDocs = periodos.reduce(
    (acc, p) => acc + (p.facturaPdfUrl ? 1 : 0) + (p.facturaXmlUrl ? 1 : 0) + p.pagos.filter((pg) => pg.comprobanteUrl).length,
    0
  );

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center flex-shrink-0"
            style={{ width: 27, height: 27, borderRadius: "50%", background: "#EDE9FE", color: "#6D28D9" }}
          >
            <FolderOpen size={13.5} strokeWidth={1.9} />
          </span>
          <h2 className="text-heading-2">Facturas y comprobantes de este Cobro</h2>
        </div>
        <span className="text-caption text-text-tertiary">
          {totalDocs} documento{totalDocs === 1 ? "" : "s"} en {periodos.length} período
          {periodos.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-3">
        {periodos.map((p) => (
          <div
            key={p.periodoId}
            className="rounded-[12px] p-3.5 space-y-3"
            style={{
              border: `1px solid ${p.esPeriodoActual ? "var(--accent)" : "var(--border-subtle)"}`,
              background: p.esPeriodoActual ? "var(--bg-overlay)" : "var(--bg-surface)",
            }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-body-medium truncate">{p.etiqueta}</span>
                {p.esPeriodoActual && <span className="badge badge-neutral shrink-0">Este período</span>}
              </span>
              <span className={`badge ${badgeEstadoPeriodo(p.estado)} shrink-0`}>
                {labelEstadoPeriodo(p.estado)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Chip
                icon={FileText}
                label={p.facturaPdfNombre ?? "Factura PDF"}
                url={p.facturaPdfUrl}
                colorBg="#FEE2E2"
                colorFg="#DC2626"
              />
              <Chip
                icon={FileCode2}
                label={p.facturaXmlNombre ?? "Factura XML"}
                url={p.facturaXmlUrl}
                colorBg="#DBEAFE"
                colorFg="#2563EB"
              />
            </div>

            {p.pagos.length > 0 && (
              <div className="pt-2.5 border-t space-y-1.5" style={{ borderColor: "var(--border-faint)" }}>
                {p.pagos.map((pg) => (
                  <div key={pg.id} className="flex items-center justify-between gap-2 text-caption">
                    <span className="flex items-center gap-2 min-w-0">
                      <Receipt size={12} strokeWidth={1.75} className="text-text-tertiary shrink-0" />
                      <span className="num-tabular text-text-secondary">{fmtMonto(pg.monto)}</span>
                      <span className="text-text-tertiary">{formatFechaCorta(pg.fecha)}</span>
                    </span>
                    {pg.comprobanteUrl ? (
                      <a
                        href={pg.comprobanteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:underline shrink-0"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Ver comprobante
                        <ExternalLink size={11} strokeWidth={1.75} />
                      </a>
                    ) : (
                      <span className="text-text-tertiary shrink-0">Sin comprobante</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
