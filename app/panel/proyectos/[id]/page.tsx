import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Landmark, CheckCircle2, History } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { DatosGeneralesCard, NotasCard, EstadoCard, type ProyectoData } from "./FichaProyecto";
import ContactosFacturacion, { type ContactoFacturacion } from "./ContactosFacturacion";
import SoporteCard from "./SoporteCard";
import ProyectoTabs, {
  type CotizacionProyectoRow,
  type CobroProyectoRow,
} from "./ProyectoTabs";
import { montoCotizacion } from "@/lib/cotizaciones/calculos";
import { montoPagado, pendientePeriodo } from "@/lib/cobros/calculos";
import { calcularSaludFinanciera } from "@/lib/proyectos/salud";

export const dynamic = "force-dynamic";

// Estados de cotización previos a "aprobada" — todavía no hay compromiso
// firme del cliente, cuentan como "cotizado sin aprobar".
const ESTADOS_SIN_APROBAR = [
  "por_estimar",
  "pendiente_revision_interna",
  "esperando_aprobacion",
  "cambios_solicitados",
  "enviada",
];
// "Aprobados" para el KPI incluye tanto lo ya aprobado por el cliente como
// lo que ya se está desarrollando (ambos son compromiso firme).
const ESTADOS_APROBADOS = ["aprobada", "en_desarrollo"];

const SELECT_BASE =
  "id, nombre, contacto_principal, rfc, correo, telefono, precio_hora_venta, moneda_hora, color, notas, activo";
const SELECT_FULL = `${SELECT_BASE}, emoji, soporte_activo, soporte_tipo, soporte_horas_fijas, soporte_tarifa_hora`;
const SELECT_SIN_SOPORTE = `${SELECT_BASE}, emoji`;

async function getProyecto(id: string): Promise<ProyectoData | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  let { data, error }: { data: any; error: any } = await supa
    .from("proyectos")
    .select(SELECT_FULL)
    .eq("id", id)
    .maybeSingle();
  // Degradación si la migración 0023 (columnas de soporte) todavía no se corrió.
  if (error && /soporte_(activo|tipo|horas_fijas|tarifa_hora)/i.test(error.message)) {
    ({ data, error } = await supa
      .from("proyectos")
      .select(SELECT_SIN_SOPORTE)
      .eq("id", id)
      .maybeSingle());
  }
  // Degradación si la migración de `emoji` todavía no se corrió.
  if (error && /emoji/i.test(error.message)) {
    ({ data, error } = await supa
      .from("proyectos")
      .select(SELECT_BASE)
      .eq("id", id)
      .maybeSingle());
  }
  if (data) {
    if (!("emoji" in data)) data.emoji = "";
    if (!("soporte_activo" in data)) data.soporte_activo = false;
    if (!("soporte_tipo" in data)) data.soporte_tipo = null;
    if (!("soporte_horas_fijas" in data)) data.soporte_horas_fijas = null;
    if (!("soporte_tarifa_hora" in data)) data.soporte_tarifa_hora = null;
  }
  return (data as ProyectoData) ?? null;
}

async function getContactosFacturacion(proyectoId: string): Promise<ContactoFacturacion[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("proyectos_contactos_facturacion")
    .select("id, correo, nombre")
    .eq("proyecto_id", proyectoId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[proyectos] error cargando contactos de facturación:", error);
    return [];
  }
  return (data ?? []) as ContactoFacturacion[];
}

// Cotizaciones ligadas a este proyecto (por `proyecto_clickup_id`, que
// pese al nombre heredado guarda el id real del catálogo de Proyectos —
// mismo campo que usa ProyectoEditor/ProyectoSearch).
async function getCotizacionesProyecto(
  proyectoId: string,
  precioHoraVenta: number | null
): Promise<CotizacionProyectoRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("cotizaciones")
    .select("id, nombre, estado, created_at, horas_envio, tipo_precio, monto_fijo")
    .eq("proyecto_clickup_id", proyectoId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[proyectos] error cargando cotizaciones:", error);
    return [];
  }
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    created_at: c.created_at,
    monto: montoCotizacion(c, precioHoraVenta),
  }));
}

// Cobros (períodos + sus pagos) ligados a este proyecto — vía `cobros.proyecto_id`.
async function getCobrosProyecto(proyectoId: string): Promise<CobroProyectoRow[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();

  const { data: cobrosRaw, error: errCobros } = await supa
    .from("cobros")
    .select("id, origen, titulo")
    .eq("proyecto_id", proyectoId);
  if (errCobros || !cobrosRaw || cobrosRaw.length === 0) {
    if (errCobros) console.error("[proyectos] error cargando cobros:", errCobros);
    return [];
  }
  const cobroIds = cobrosRaw.map((c: any) => c.id);
  const infoCobro = new Map(cobrosRaw.map((c: any) => [c.id, { origen: c.origen, titulo: c.titulo }]));

  const { data: periodosRaw, error: errPeriodos } = await supa
    .from("cobros_periodos")
    .select("id, cobro_id, estado, etiqueta, monto, moneda, created_at, cobros_pagos(monto, fecha)")
    .in("cobro_id", cobroIds)
    .order("created_at", { ascending: false });
  if (errPeriodos) {
    console.error("[proyectos] error cargando períodos de cobro:", errPeriodos);
    return [];
  }

  const countPorCobro = new Map<string, number>();
  for (const p of (periodosRaw ?? []) as any[]) {
    countPorCobro.set(p.cobro_id, (countPorCobro.get(p.cobro_id) ?? 0) + 1);
  }

  return ((periodosRaw ?? []) as any[]).map((p) => {
    const info = infoCobro.get(p.cobro_id) as { origen: string; titulo: string } | undefined;
    const origen = (info?.origen ?? "desarrollo") as "desarrollo" | "soporte";
    const numPeriodos = countPorCobro.get(p.cobro_id) ?? 1;
    const tipoPago: CobroProyectoRow["tipoPago"] =
      origen === "soporte" ? "mensual" : numPeriodos > 1 ? "parcialidades" : "unico";
    return {
      id: p.id,
      titulo: info?.titulo ?? "",
      origen,
      estado: p.estado,
      etiqueta: p.etiqueta,
      monto: Number(p.monto) || 0,
      moneda: p.moneda ?? "MXN",
      created_at: p.created_at,
      tipoPago,
      pagos: ((p.cobros_pagos ?? []) as any[]).map((pg) => ({
        monto: Number(pg.monto) || 0,
        fecha: pg.fecha,
      })),
    };
  });
}

export default async function ProyectoDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const [proyecto, contactosFacturacion] = await Promise.all([
    getProyecto(params.id),
    getContactosFacturacion(params.id),
  ]);
  if (!proyecto) notFound();

  const [cotizaciones, cobros] = await Promise.all([
    getCotizacionesProyecto(proyecto.id, proyecto.precio_hora_venta),
    getCobrosProyecto(proyecto.id),
  ]);

  const totalCotizadoSinAprobar = cotizaciones
    .filter((c) => ESTADOS_SIN_APROBAR.includes(c.estado))
    .reduce((acc, c) => acc + (c.monto ?? 0), 0);

  const numAprobados = cotizaciones.filter((c) => ESTADOS_APROBADOS.includes(c.estado)).length;

  const totalPendientePago = cobros.reduce(
    (acc, c) => acc + pendientePeriodo({ monto: c.monto }, c.pagos),
    0
  );

  const totalHistorico = cobros.reduce((acc, c) => acc + montoPagado(c.pagos), 0);

  const salud = calcularSaludFinanciera(cobros);

  const fmtMxn = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const kpis: { label: string; value: string; icon: typeof FileText; iconBg: string; iconFg: string; sub?: string }[] = [
    {
      label: "Cotizado sin aprobar",
      value: fmtMxn(totalCotizadoSinAprobar),
      icon: FileText,
      iconBg: "#FEF3C7",
      iconFg: "#B45309",
    },
    {
      label: "Pendiente de pago",
      value: fmtMxn(totalPendientePago),
      icon: Landmark,
      iconBg: "#FEE2E2",
      iconFg: "#DC2626",
    },
    {
      label: "Cotizaciones aprobadas",
      value: String(numAprobados),
      icon: CheckCircle2,
      iconBg: "#DCFCE7",
      iconFg: "#15803D",
      sub: "aprobadas o en desarrollo",
    },
    {
      label: "Total histórico cobrado",
      value: fmtMxn(totalHistorico),
      icon: History,
      iconBg: "#DBEAFE",
      iconFg: "#1D4ED8",
    },
  ];

  const detalle = (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <DatosGeneralesCard proyecto={proyecto} />
        <div className="space-y-4 lg:col-start-2">
          <ContactosFacturacion proyectoId={proyecto.id} contactosIniciales={contactosFacturacion} />
          <NotasCard proyecto={proyecto} />
        </div>
      </div>

      <div className="mt-4">
        <EstadoCard proyecto={proyecto} />
      </div>
      <div className="mt-4">
        <SoporteCard proyecto={proyecto} />
      </div>
    </>
  );

  return (
    <>
      <Link
        href="/panel/proyectos"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver a proyectos
      </Link>

      <header className="flex items-center gap-3 flex-wrap">
        <span
          style={{ width: 14, height: 14, borderRadius: "50%", background: proyecto.color, flexShrink: 0 }}
        />
        <h1 className="text-display">
          {proyecto.emoji ? `${proyecto.emoji} ` : ""}
          {proyecto.nombre}
        </h1>
        <span className={`badge ${proyecto.activo ? "badge-success" : "badge-neutral"}`}>
          {proyecto.activo ? "Activo" : "Inactivo"}
        </span>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {kpis.map((k) => (
          <div key={k.label} className="card card-hover">
            <div className="flex items-center gap-2">
              <span
                className="grid place-items-center flex-shrink-0"
                style={{ width: 27, height: 27, borderRadius: "50%", background: k.iconBg, color: k.iconFg }}
              >
                <k.icon size={13.5} strokeWidth={1.9} />
              </span>
              <span className="text-caption" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                {k.label}
              </span>
            </div>
            <div
              className="num-tabular"
              style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-1.1px", lineHeight: 1.1, marginTop: 13 }}
            >
              {k.value}
            </div>
            {k.sub && (
              <div
                className="text-caption num-tabular"
                style={{ color: "var(--text-tertiary)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
              >
                {k.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <ProyectoTabs detalle={detalle} cotizaciones={cotizaciones} cobros={cobros} salud={salud} />
    </>
  );
}
