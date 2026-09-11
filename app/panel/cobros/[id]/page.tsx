import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { labelOrigenCobro } from "@/lib/estados/cobros";
import { textoContrastante } from "@/lib/proyectos/colores";
import {
  PeriodoAcciones,
  AgregarPeriodoForm,
  DividirParcialidadesForm,
} from "@/components/forms/CobroPeriodoEditor";
import CobroPeriodoTabs from "@/components/forms/CobroPeriodoTabs";

export const dynamic = "force-dynamic";

const BUCKET_FACTURAS = "cobros-facturas";

type PeriodoHermano = {
  id: string;
  estado: string;
  etiqueta: string;
  monto: number;
  moneda: string;
};

type Detalle = {
  periodo: {
    id: string;
    estado: string;
    etiqueta: string;
    monto: number;
    moneda: string;
    mes: number | null;
    anio: number | null;
    factura_pdf_path: string | null;
    factura_xml_path: string | null;
    cobro_id: string;
  };
  cobro: {
    id: string;
    origen: string;
    titulo: string;
    monto_total: number | null;
    moneda: string;
    cotizacion_id: string | null;
    proyecto_nombre: string | null;
    proyecto_color: string | null;
    proyecto_emoji: string | null;
  };
  hermanos: PeriodoHermano[];
  totalCobradoContrato: number;
  facturaPdfUrl: string | null;
  facturaXmlUrl: string | null;
  pagos: { id: string; monto: number; fecha: string; notas: string | null; comprobante_url: string | null }[];
  pagosContrato: {
    id: string;
    monto: number;
    fecha: string;
    periodoId: string;
    periodoEtiqueta: string;
    esPeriodoActual: boolean;
  }[];
};

async function getDetalle(id: string): Promise<Detalle | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();

  const { data: periodo, error } = await supa
    .from("cobros_periodos")
    .select(
      "id, estado, etiqueta, monto, moneda, mes, anio, factura_pdf_path, factura_xml_path, cobro_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !periodo) return null;

  const { data: cobroRaw } = await supa
    .from("cobros")
    .select("id, origen, titulo, monto_total, moneda, cotizacion_id, proyectos(nombre, color, emoji)")
    .eq("id", periodo.cobro_id)
    .maybeSingle();
  if (!cobroRaw) return null;
  const proyecto = Array.isArray((cobroRaw as any).proyectos)
    ? (cobroRaw as any).proyectos[0]
    : (cobroRaw as any).proyectos;

  const { data: hermanosRaw } = await supa
    .from("cobros_periodos")
    .select("id, estado, etiqueta, monto, moneda, orden, created_at")
    .eq("cobro_id", periodo.cobro_id)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  const hermanos: PeriodoHermano[] = ((hermanosRaw ?? []) as any[]).map((h) => ({
    id: h.id,
    estado: h.estado,
    etiqueta: h.etiqueta,
    monto: Number(h.monto) || 0,
    moneda: h.moneda ?? "MXN",
  }));

  const idsHermanos = hermanos.map((h) => h.id);
  let totalCobradoContrato = 0;
  let pagosContrato: Detalle["pagosContrato"] = [];
  if (idsHermanos.length > 0) {
    const { data: pagosContratoRaw } = await supa
      .from("cobros_pagos")
      .select("id, monto, fecha, periodo_id")
      .in("periodo_id", idsHermanos)
      .order("fecha", { ascending: false });
    totalCobradoContrato = ((pagosContratoRaw ?? []) as any[]).reduce(
      (acc, p) => acc + (Number(p.monto) || 0),
      0
    );
    const etiquetaPorPeriodo = new Map(hermanos.map((h) => [h.id, h.etiqueta]));
    pagosContrato = ((pagosContratoRaw ?? []) as any[]).map((p) => ({
      id: p.id,
      monto: Number(p.monto) || 0,
      fecha: p.fecha,
      periodoId: p.periodo_id,
      periodoEtiqueta: etiquetaPorPeriodo.get(p.periodo_id) ?? "—",
      esPeriodoActual: p.periodo_id === id,
    }));
  }

  let facturaPdfUrl: string | null = null;
  let facturaXmlUrl: string | null = null;
  try {
    if (periodo.factura_pdf_path) {
      const { data: signed } = await supa.storage
        .from(BUCKET_FACTURAS)
        .createSignedUrl(periodo.factura_pdf_path, 3600);
      facturaPdfUrl = signed?.signedUrl ?? null;
    }
    if (periodo.factura_xml_path) {
      const { data: signed } = await supa.storage
        .from(BUCKET_FACTURAS)
        .createSignedUrl(periodo.factura_xml_path, 3600);
      facturaXmlUrl = signed?.signedUrl ?? null;
    }
  } catch {}

  const { data: pagosRaw } = await supa
    .from("cobros_pagos")
    .select("id, monto, fecha, notas, comprobante_path")
    .eq("periodo_id", id)
    .order("fecha", { ascending: false });

  const pagos = await Promise.all(
    ((pagosRaw ?? []) as any[]).map(async (p) => {
      let comprobanteUrl: string | null = null;
      if (p.comprobante_path) {
        try {
          const { data: signed } = await supa.storage
            .from(BUCKET_FACTURAS)
            .createSignedUrl(p.comprobante_path, 3600);
          comprobanteUrl = signed?.signedUrl ?? null;
        } catch {}
      }
      return {
        id: p.id,
        monto: Number(p.monto) || 0,
        fecha: p.fecha,
        notas: p.notas ?? null,
        comprobante_url: comprobanteUrl,
      };
    })
  );

  return {
    periodo: {
      id: periodo.id,
      estado: periodo.estado,
      etiqueta: periodo.etiqueta,
      monto: Number(periodo.monto) || 0,
      moneda: periodo.moneda ?? "MXN",
      mes: periodo.mes,
      anio: periodo.anio,
      factura_pdf_path: periodo.factura_pdf_path,
      factura_xml_path: periodo.factura_xml_path,
      cobro_id: periodo.cobro_id,
    },
    cobro: {
      id: (cobroRaw as any).id,
      origen: (cobroRaw as any).origen,
      titulo: (cobroRaw as any).titulo,
      monto_total: (cobroRaw as any).monto_total != null ? Number((cobroRaw as any).monto_total) : null,
      moneda: (cobroRaw as any).moneda ?? "MXN",
      cotizacion_id: (cobroRaw as any).cotizacion_id,
      proyecto_nombre: proyecto?.nombre ?? null,
      proyecto_color: proyecto?.color ?? null,
      proyecto_emoji: proyecto?.emoji ?? null,
    },
    hermanos,
    totalCobradoContrato,
    facturaPdfUrl,
    facturaXmlUrl,
    pagos,
    pagosContrato,
  };
}

function fmtMonto(n: number, moneda: string): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function CobroPeriodoPage({ params }: { params: { id: string } }) {
  const detalle = await getDetalle(params.id);
  if (!detalle) notFound();

  const { periodo, cobro, hermanos, totalCobradoContrato, facturaPdfUrl, facturaXmlUrl, pagos, pagosContrato } =
    detalle;

  return (
    <>
      <Link
        href="/panel/cobros"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Volver a Cobros
      </Link>

      <header className="card space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-display">{periodo.etiqueta}</h1>
            <p className="text-caption text-text-secondary flex items-center gap-2 flex-wrap">
              <span
                className="badge"
                style={{
                  background: cobro.origen === "soporte" ? "#CCFBF1" : "#E0E7FF",
                  color: cobro.origen === "soporte" ? "#0D9488" : "#4F46E5",
                }}
              >
                {labelOrigenCobro(cobro.origen)}
              </span>
              <span>{cobro.titulo}</span>
              {cobro.proyecto_nombre && (
                <span
                  className="inline-block text-caption truncate"
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 600,
                    background: cobro.proyecto_color ?? "var(--bg-overlay)",
                    color: cobro.proyecto_color
                      ? textoContrastante(cobro.proyecto_color)
                      : "var(--text-secondary)",
                  }}
                >
                  {cobro.proyecto_emoji ? `${cobro.proyecto_emoji} ` : ""}
                  {cobro.proyecto_nombre}
                </span>
              )}
              {cobro.cotizacion_id && (
                <Link
                  href={`/panel/cotizaciones/${cobro.cotizacion_id}`}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink size={12} strokeWidth={1.75} />
                  Cotización de origen
                </Link>
              )}
            </p>
          </div>
        </div>
      </header>

      <section className="card space-y-3">
        <h2 className="text-heading-2">Datos generales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-overline text-text-tertiary">Monto de este período</div>
            <div className="mt-1 num-tabular text-body-medium">{fmtMonto(periodo.monto, periodo.moneda)}</div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary">Monto total del contrato</div>
            <div className="mt-1 num-tabular text-body-medium">
              {cobro.monto_total != null ? fmtMonto(cobro.monto_total, cobro.moneda) : "Abierto (recurrente)"}
            </div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary">Cobrado a la fecha (todo el contrato)</div>
            <div className="mt-1 num-tabular text-body-medium" style={{ color: "var(--state-success)" }}>
              {fmtMonto(totalCobradoContrato, cobro.moneda)}
            </div>
          </div>
        </div>

        {hermanos.length > 1 && (
          <div>
            <div className="text-overline text-text-tertiary mb-1.5">Períodos de este contrato</div>
            <div className="flex flex-wrap gap-2">
              {hermanos.map((h) => (
                <Link
                  key={h.id}
                  href={`/panel/cobros/${h.id}`}
                  className="badge"
                  style={{
                    background: h.id === periodo.id ? "var(--action-primary-bg)" : "var(--bg-overlay)",
                    color: h.id === periodo.id ? "var(--action-primary-text)" : "var(--text-secondary)",
                  }}
                >
                  {h.etiqueta}
                </Link>
              ))}
            </div>
          </div>
        )}

        {cobro.origen === "desarrollo" && cobro.monto_total != null && (
          <div className="flex flex-wrap gap-2">
            <DividirParcialidadesForm
              cobroId={periodo.cobro_id}
              montoTotal={cobro.monto_total}
              moneda={cobro.moneda}
            />
            <AgregarPeriodoForm cobroId={periodo.cobro_id} moneda={cobro.moneda} />
          </div>
        )}
      </section>

      <PeriodoAcciones
        periodoId={periodo.id}
        estado={periodo.estado}
        etiqueta={periodo.etiqueta}
        monto={periodo.monto}
        moneda={periodo.moneda}
        esUltimoPeriodo={hermanos.length <= 1}
      />

      <CobroPeriodoTabs
        periodoId={periodo.id}
        periodoEtiqueta={periodo.etiqueta}
        estado={periodo.estado}
        montoPeriodo={periodo.monto}
        moneda={periodo.moneda}
        facturaPdfUrl={facturaPdfUrl}
        facturaPdfNombre={periodo.factura_pdf_path ? periodo.factura_pdf_path.split("/").pop() ?? null : null}
        facturaXmlUrl={facturaXmlUrl}
        facturaXmlNombre={periodo.factura_xml_path ? periodo.factura_xml_path.split("/").pop() ?? null : null}
        pagos={pagos}
        pagosContrato={pagosContrato}
        mostrarLedgerContrato={hermanos.length > 1}
      />
    </>
  );
}
