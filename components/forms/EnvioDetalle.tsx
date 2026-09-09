import { FileText, User, Clock, DollarSign, CalendarDays } from "lucide-react";
import { formatFechaLarga } from "@/lib/dates";

type Props = {
  pdfUrl: string | null;
  pdfNombreOriginal: string | null;
  horasTotales: number | null;
  costoAproximado: number | null;
  estimadoPor: string | null;
  fecha: string | null;
};

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Detalle del envío al cliente — se llena al subir el PDF vía
 * EnviarPdfModal / /api/cotizaciones/[id]/enviar-pdf. `pdfUrl` es una
 * signed URL (1h) generada en el server component del detalle.
 */
export default function EnvioDetalle({
  pdfUrl,
  pdfNombreOriginal,
  horasTotales,
  costoAproximado,
  estimadoPor,
  fecha,
}: Props) {
  return (
    <section
      className="rounded-[12px] overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
    >
      <div
        className="px-5 py-3 border-b flex items-center gap-2"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <FileText size={16} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="text-heading-2">Detalle del envío</h2>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-overline text-text-tertiary flex items-center gap-1">
              <Clock size={12} strokeWidth={1.75} />
              Horas totales
            </div>
            <div className="mt-1 num-tabular text-body-medium">
              {horasTotales != null ? `${horasTotales}h` : "—"}
            </div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary flex items-center gap-1">
              <DollarSign size={12} strokeWidth={1.75} />
              Costo aproximado
            </div>
            <div className="mt-1 num-tabular text-body-medium">
              {costoAproximado != null ? fmtMxn(costoAproximado) : "—"}
            </div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary flex items-center gap-1">
              <User size={12} strokeWidth={1.75} />
              Estimado por
            </div>
            <div className="mt-1 text-body-medium">{estimadoPor ?? "—"}</div>
          </div>
        </div>

        <div className="text-caption text-text-tertiary flex items-center gap-1.5">
          <CalendarDays size={12} strokeWidth={1.75} />
          {fecha ? `Enviado ${formatFechaLarga(fecha)}` : "Sin fecha"}
        </div>

        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            <FileText size={16} strokeWidth={1.75} />
            <span>Ver PDF{pdfNombreOriginal ? ` — ${pdfNombreOriginal}` : ""}</span>
          </a>
        ) : (
          <p className="text-caption text-text-tertiary">
            El enlace al PDF expiró o no se pudo generar. Recarga la página.
          </p>
        )}
      </div>
    </section>
  );
}
