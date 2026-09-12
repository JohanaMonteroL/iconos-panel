import { AlertTriangle, Landmark, CheckCircle2, Percent, FileWarning } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ORDEN_FLUJO_COBRO_PERIODO } from "@/lib/estados/cobros";
import { rangoRapidoAFechas } from "@/lib/dates";
import { montoPagado, pendientePeriodo, estadoFactura } from "@/lib/cobros/calculos";
import TableroCobros from "./TableroCobros";
import FiltrosCobros from "./FiltrosCobros";

export const dynamic = "force-dynamic";

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
  pagos: { monto: number }[];
};

function relationMissing(message: string | undefined | null): boolean {
  if (!message) return false;
  return /relation .* does not exist/i.test(message);
}

async function getPeriodos(): Promise<{ items: Row[]; migracionPendiente: boolean }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { items: [], migracionPendiente: false };
  const supa = createSupabaseServiceClient();

  const selConPagos =
    "id, estado, etiqueta, monto, moneda, created_at, factura_pdf_path, factura_xml_path, cobro_id, cobros(origen, titulo, proyecto_id, cotizacion_id), cobros_pagos(monto)";
  const selSinPagos = selConPagos.replace(", cobros_pagos(monto)", "");

  let { data, error }: { data: any; error: any } = await supa
    .from("cobros_periodos")
    .select(selConPagos)
    .order("created_at", { ascending: false });

  if (error && relationMissing(error.message) && /cobros_pagos/i.test(error.message ?? "")) {
    ({ data, error } = await supa.from("cobros_periodos").select(selSinPagos).order("created_at", { ascending: false }));
  }

  if (error) {
    if (relationMissing(error.message)) {
      return { items: [], migracionPendiente: true };
    }
    console.error("[cobros] error:", error);
    return { items: [], migracionPendiente: false };
  }

  const items: Row[] = ((data ?? []) as any[]).map((r) => {
    const cobro = Array.isArray(r.cobros) ? r.cobros[0] : r.cobros;
    return {
      id: r.id,
      estado: r.estado,
      etiqueta: r.etiqueta,
      monto: Number(r.monto) || 0,
      moneda: r.moneda ?? "MXN",
      created_at: r.created_at,
      cobro_id: r.cobro_id,
      origen: cobro?.origen ?? "desarrollo",
      titulo: cobro?.titulo ?? "",
      proyecto_id: cobro?.proyecto_id ?? null,
      cotizacion_id: cobro?.cotizacion_id ?? null,
      factura_pdf_path: r.factura_pdf_path,
      factura_xml_path: r.factura_xml_path,
      pagos: ((r.cobros_pagos ?? []) as any[]).map((p) => ({ monto: Number(p.monto) || 0 })),
    };
  });

  return { items, migracionPendiente: false };
}

async function getInfoProyectos(): Promise<{
  coloresProyecto: Record<string, string>;
  emojisProyecto: Record<string, string>;
  nombresProyecto: Record<string, string>;
  nombresUnicos: string[];
}> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { coloresProyecto: {}, emojisProyecto: {}, nombresProyecto: {}, nombresUnicos: [] };
  }
  const supa = createSupabaseServiceClient();
  let { data, error }: { data: any; error: any } = await supa
    .from("proyectos")
    .select("id, nombre, color, emoji");
  if (error && /emoji/i.test(error.message)) {
    ({ data, error } = await supa.from("proyectos").select("id, nombre, color"));
  }
  const coloresProyecto: Record<string, string> = {};
  const emojisProyecto: Record<string, string> = {};
  const nombresProyecto: Record<string, string> = {};
  for (const r of (data ?? []) as any[]) {
    if (!r.id) continue;
    coloresProyecto[r.id] = r.color;
    if (r.emoji) emojisProyecto[r.id] = r.emoji;
    nombresProyecto[r.id] = r.nombre;
  }
  const nombresUnicos = Array.from(new Set(Object.values(nombresProyecto))).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
  return { coloresProyecto, emojisProyecto, nombresProyecto, nombresUnicos };
}

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Variación vs. el mes pasado — siempre comparando el mes calendario en
// curso contra el mes calendario anterior (independiente del filtro de
// fecha que la usuaria haya elegido en la página), para que el badge de
// tendencia tenga siempre el mismo significado.
function calcularDelta(actual: number, anterior: number): { texto: string; tono: "up" | "down" | "neutral" } {
  if (anterior === 0 && actual === 0) return { texto: "sin cambios vs. mes pasado", tono: "neutral" };
  if (anterior === 0) return { texto: "nuevo este mes", tono: "up" };
  const pct = ((actual - anterior) / anterior) * 100;
  const signo = pct > 0 ? "+" : "";
  const tono: "up" | "down" | "neutral" = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "neutral";
  return { texto: `${signo}${pct.toFixed(0)}% vs. mes pasado`, tono };
}

function colorTono(tono: "up" | "down" | "neutral"): string {
  if (tono === "up") return "var(--state-success)";
  if (tono === "down") return "var(--state-error)";
  return "var(--text-tertiary)";
}

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    estado?: string;
    proyecto?: string;
    desde?: string;
    hasta?: string;
    rango?: string;
    orden?: string;
  };
}) {
  const [{ items: todos, migracionPendiente }, { coloresProyecto, emojisProyecto, nombresProyecto, nombresUnicos }] =
    await Promise.all([getPeriodos(), getInfoProyectos()]);

  const rango = searchParams.rango ?? null;
  const { desde, hasta } =
    rango === "este_mes" || rango === "mes_pasado"
      ? rangoRapidoAFechas(rango)
      : { desde: searchParams.desde ?? null, hasta: searchParams.hasta ?? null };

  const q = searchParams.q?.trim().toLowerCase() || null;
  const estado = searchParams.estado || null;
  const proyecto = searchParams.proyecto || null;
  const orden = searchParams.orden || null;

  const items = todos
    .filter((it) => {
      if (q && !it.etiqueta.toLowerCase().includes(q) && !it.titulo.toLowerCase().includes(q)) return false;
      if (estado && it.estado !== estado) return false;
      if (proyecto && (!it.proyecto_id || nombresProyecto[it.proyecto_id] !== proyecto)) return false;
      if (desde && it.created_at < `${desde}T00:00:00`) return false;
      if (hasta && it.created_at > `${hasta}T23:59:59`) return false;
      return true;
    })
    .sort((a, b) => {
      if (orden === "nombre") return a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" });
      if (orden === "monto") return b.monto - a.monto;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // ── KPIs — respetan los mismos filtros que el tablero (q/estado/proyecto/
  // fecha), salvo la comparación "vs. mes pasado", que siempre usa el mes
  // calendario actual y el anterior (con q/estado/proyecto aplicados, pero
  // ignorando el filtro de fecha de la usuaria, para que el badge de
  // tendencia no cambie de significado según qué rango tenga seleccionado).
  const pasaFiltrosNoFecha = (it: Row) => {
    if (q && !it.etiqueta.toLowerCase().includes(q) && !it.titulo.toLowerCase().includes(q)) return false;
    if (estado && it.estado !== estado) return false;
    if (proyecto && (!it.proyecto_id || nombresProyecto[it.proyecto_id] !== proyecto)) return false;
    return true;
  };
  const itemsSinFiltroFecha = todos.filter(pasaFiltrosNoFecha);
  const { desde: desdeMesActual, hasta: hastaMesActual } = rangoRapidoAFechas("este_mes");
  const { desde: desdeMesPasado, hasta: hastaMesPasado } = rangoRapidoAFechas("mes_pasado");
  const enRango = (it: Row, d: string, h: string) =>
    it.created_at >= `${d}T00:00:00` && it.created_at <= `${h}T23:59:59`;
  const itemsMesActual = itemsSinFiltroFecha.filter((it) => enRango(it, desdeMesActual, hastaMesActual));
  const itemsMesPasado = itemsSinFiltroFecha.filter((it) => enRango(it, desdeMesPasado, hastaMesPasado));

  const sumaPendiente = (arr: Row[]) => arr.reduce((acc, it) => acc + pendientePeriodo(it, it.pagos), 0);
  const sumaCobrado = (arr: Row[]) => arr.reduce((acc, it) => acc + montoPagado(it.pagos), 0);

  const pendienteTotal = sumaPendiente(items);
  const deltaPendiente = calcularDelta(sumaPendiente(itemsMesActual), sumaPendiente(itemsMesPasado));

  const cobradoTotal = sumaCobrado(items);
  const deltaCobrado = calcularDelta(sumaCobrado(itemsMesActual), sumaCobrado(itemsMesPasado));

  const montoTotalFiltrado = items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
  const tasaCobro = montoTotalFiltrado > 0 ? (cobradoTotal / montoTotalFiltrado) * 100 : 0;

  const sinFacturaCompleta = items.filter((it) => estadoFactura(it) !== "completa").length;

  const kpis: {
    label: string;
    value: string;
    icon: typeof Landmark;
    iconBg: string;
    iconFg: string;
    sub?: string;
    delta?: { texto: string; tono: "up" | "down" | "neutral" };
  }[] = [
    {
      label: "Pendiente por cobrar",
      value: fmtMxn(pendienteTotal),
      icon: Landmark,
      iconBg: "#FEF3C7",
      iconFg: "#B45309",
      delta: deltaPendiente,
    },
    {
      label: "Total cobrado",
      value: fmtMxn(cobradoTotal),
      icon: CheckCircle2,
      iconBg: "#DCFCE7",
      iconFg: "#15803D",
      delta: deltaCobrado,
    },
    {
      label: "Tasa de cobro",
      value: `${tasaCobro.toFixed(0)}%`,
      icon: Percent,
      iconBg: "#DBEAFE",
      iconFg: "#1D4ED8",
      sub: "cobrado / monto total filtrado",
    },
    {
      label: "Sin factura completa",
      value: String(sinFacturaCompleta),
      icon: FileWarning,
      iconBg: "#EDE9FE",
      iconFg: "#6D28D9",
      sub: `de ${items.length} período${items.length === 1 ? "" : "s"} filtrado${items.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Cobros</h1>
          <p className="text-body text-text-secondary">
            Seguimiento de pagos — desarrollo y soporte, por período.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AutoRefresh intervalSeconds={15} />
        </div>
      </header>

      {!migracionPendiente && todos.length > 0 && (
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
              {(k.delta || k.sub) && (
                <div
                  className="text-caption"
                  style={{ color: k.delta ? colorTono(k.delta.tono) : "var(--text-tertiary)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
                >
                  {k.delta ? k.delta.texto : k.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {migracionPendiente ? (
        <div className="card flex items-start gap-3">
          <AlertTriangle size={20} strokeWidth={1.75} style={{ color: "var(--state-warning, #B45309)" }} />
          <div>
            <p className="text-body-medium">Falta correr la migración de Cobros</p>
            <p className="text-caption text-text-secondary mt-1">
              Corre <code>supabase/migrations/0022_cobros.sql</code> (y 0023, 0024) en el SQL
              Editor de Supabase para activar esta sección.
            </p>
          </div>
        </div>
      ) : todos.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin cobros todavía. Se crean automáticamente cuando una cotización pasa a
          &quot;Enviar a Cobros&quot;, o cuando corre la generación mensual de Soporte.
        </div>
      ) : (
        <>
          <FiltrosCobros
            proyectos={nombresUnicos}
            actuales={{ q: searchParams.q ?? null, estado, proyecto, desde, hasta, rango, orden }}
          />
          {items.length === 0 ? (
            <div className="card text-body text-text-secondary text-center py-10">
              Sin cobros que coincidan con los filtros.
            </div>
          ) : (
            <TableroCobros
              columnas={ORDEN_FLUJO_COBRO_PERIODO}
              itemsIniciales={items}
              coloresProyecto={coloresProyecto}
              emojisProyecto={emojisProyecto}
              nombresProyecto={nombresProyecto}
            />
          )}
        </>
      )}
    </>
  );
}
