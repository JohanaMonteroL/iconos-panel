// Vista nueva de Cotizaciones (WIP) — mismo backend/tablas que
// /panel/cotizaciones, solo cambia el front. Vive en una ruta aparte
// mientras se valida; cuando se apruebe, reemplaza a la vista actual.
//
// Diseño: tablero kanban por estado (columna = ESTADOS_COTIZACION),
// inspirado en la sección "Cotizaciones CRM" del mockup de Claude Design.

import Link from "next/link";
import { Clock, DollarSign, ExternalLink, FileText } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ORDEN_FLUJO_COTIZACION } from "@/lib/estados";
import FiltrosCotizaciones from "@/app/panel/cotizaciones/FiltrosCotizaciones";
import CrearMenu from "@/app/panel/cotizaciones/CrearMenu";
import TableroCotizaciones from "./TableroCotizaciones";

export const dynamic = "force-dynamic";

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

type Filtros = {
  q: string | null;
  estado: string | null;
  programador: string | null;
  proyecto: string | null;
  desde: string | null;
  hasta: string | null;
  archivadas: boolean;
};

const estadosVisibles = ORDEN_FLUJO_COTIZACION.filter((e) => e !== "archivada");

async function getCotizaciones(filtros: Filtros): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();

  const selCompleto =
    "id, nombre, estado, horas_min, horas_max, created_at, programador_id, tipo_precio, monto_fijo, proyecto_nombre, programadores(nombre)";
  const selSinProy = selCompleto.replace(", proyecto_nombre", "");
  const selBasico = selSinProy.replace(", tipo_precio, monto_fijo", "");

  const aplicarFiltros = (qb: any) => {
    let q = qb;
    if (!filtros.archivadas) {
      if (filtros.estado) q = q.eq("estado", filtros.estado);
      else q = q.in("estado", estadosVisibles);
    } else if (filtros.estado) {
      q = q.eq("estado", filtros.estado);
    }
    if (filtros.programador) q = q.eq("programador_id", filtros.programador);
    if (filtros.proyecto) q = q.eq("proyecto_nombre", filtros.proyecto);
    if (filtros.q) q = q.ilike("nombre", `%${filtros.q}%`);
    if (filtros.desde) q = q.gte("created_at", `${filtros.desde}T00:00:00`);
    if (filtros.hasta) q = q.lte("created_at", `${filtros.hasta}T23:59:59`);
    return q;
  };

  const intentar = async (sel: string) =>
    aplicarFiltros(
      supa.from("cotizaciones").select(sel).order("created_at", { ascending: false }).limit(300)
    );

  let resp: any = await intentar(selCompleto);
  if (resp.error && /proyecto_nombre/i.test(resp.error.message)) {
    resp = await intentar(selSinProy);
  }
  if (resp.error && /(tipo_precio|monto_fijo)/i.test(resp.error.message)) {
    resp = await intentar(selBasico);
  }
  if (resp.error) {
    console.error("[cotizaciones-v2] error:", resp.error);
    return [];
  }
  return (resp.data ?? []) as unknown as Row[];
}

async function getProgramadores(): Promise<{ id: string; nombre: string }[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data } = await supa.from("programadores").select("id, nombre").order("nombre", { ascending: true });
  return (data ?? []) as any[];
}

// Nombres para el filtro "Proyecto" — vienen del catálogo de Proyectos
// (activos), no de texto libre en cotizaciones. Así el nombre siempre
// coincide con el proyecto real y su color de etiqueta.
async function getProyectos(): Promise<string[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("proyectos")
    .select("nombre")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return ((data ?? []) as any[]).map((r) => r.nombre);
}

// Mapa nombre (lowercase) -> color, para pintar la etiqueta de proyecto en
// las tarjetas del tablero con el mismo color elegido en el catálogo.
async function getColoresProyecto(): Promise<Record<string, string>> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return {};
  const supa = createSupabaseServiceClient();
  const { data } = await supa.from("proyectos").select("nombre, color");
  const mapa: Record<string, string> = {};
  for (const r of (data ?? []) as any[]) {
    if (r.nombre) mapa[String(r.nombre).trim().toLowerCase()] = r.color;
  }
  return mapa;
}

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default async function CotizacionesV2Page({
  searchParams,
}: {
  searchParams: {
    archivadas?: string;
    q?: string;
    estado?: string;
    programador?: string;
    proyecto?: string;
    desde?: string;
    hasta?: string;
  };
}) {
  const filtros: Filtros = {
    archivadas: searchParams.archivadas === "1",
    q: searchParams.q ?? null,
    estado: searchParams.estado ?? null,
    programador: searchParams.programador ?? null,
    proyecto: searchParams.proyecto ?? null,
    desde: searchParams.desde ?? null,
    hasta: searchParams.hasta ?? null,
  };

  const [items, programadores, proyectos, coloresProyecto] = await Promise.all([
    getCotizaciones(filtros),
    getProgramadores(),
    getProyectos(),
    getColoresProyecto(),
  ]);

  const pipelineFijo = items
    .filter((it) => it.tipo_precio === "fijo" && it.monto_fijo != null)
    .reduce((acc, it) => acc + Number(it.monto_fijo), 0);

  const ESTADOS_EN_PROCESO = ["por_estimar", "pendiente_revision_interna", "esperando_aprobacion", "cambios_solicitados"];
  const ESTADOS_EN_CURSO = ["enviada", "aprobada", "en_desarrollo"];
  const ESTADOS_POR_COBRAR = ["en_espera_de_cobro", "pendiente_por_cobrar"];

  const kpis = [
    {
      label: "Cotizaciones activas",
      value: String(items.length),
      icon: FileText,
      iconBg: "#DBEAFE",
      iconFg: "#1D4ED8",
      sub: "sin archivar",
    },
    {
      label: "En revisión interna",
      value: String(items.filter((it) => ESTADOS_EN_PROCESO.includes(it.estado)).length),
      icon: Clock,
      iconBg: "#FEF3C7",
      iconFg: "#B45309",
      sub: "antes de enviarse al cliente",
    },
    {
      label: "En curso con cliente",
      value: String(items.filter((it) => ESTADOS_EN_CURSO.includes(it.estado)).length),
      icon: ExternalLink,
      iconBg: "#DCFCE7",
      iconFg: "#15803D",
      sub: "enviadas, aprobadas o en desarrollo",
    },
    {
      label: "Pipeline (monto fijo)",
      value: fmtMxn(pipelineFijo),
      icon: DollarSign,
      iconBg: "#EDE9FE",
      iconFg: "#6D28D9",
      sub: `${items.filter((it) => ESTADOS_POR_COBRAR.includes(it.estado)).length} por cobrar`,
    },
  ];

  const columnas = estadosVisibles;

  return (
    <>
      <div
        className="rounded-[9px] border px-3 py-2 text-caption flex items-center gap-2 flex-wrap"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-tertiary)" }}
      >
        <span>🚧 Vista nueva de Cotizaciones (en construcción) — mismo backend que la actual.</span>
        <Link href="/panel/cotizaciones" style={{ color: "var(--accent)" }}>
          Ir a la vista clásica →
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Cotizaciones</h1>
          <p className="text-body text-text-secondary">
            {filtros.archivadas ? "Mostrando todas (incluye archivadas)" : "Activas únicamente"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AutoRefresh intervalSeconds={15} />
          <CrearMenu />
        </div>
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
            <div
              className="text-caption num-tabular"
              style={{ color: "var(--text-tertiary)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
            >
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      <FiltrosCotizaciones programadores={programadores} proyectos={proyectos} actuales={filtros} />

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin cotizaciones que coincidan con los filtros.
        </div>
      ) : (
        <TableroCotizaciones columnas={columnas} itemsIniciales={items} coloresProyecto={coloresProyecto} />
      )}
    </>
  );
}
