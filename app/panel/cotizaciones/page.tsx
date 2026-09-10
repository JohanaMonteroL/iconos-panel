import Link from "next/link";
import { Clock, DollarSign, User, FileText, ExternalLink } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import VistaToggle from "@/components/ui/VistaToggle";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta as fmtFecha } from "@/lib/dates";
import { labelEstado, badgeEstado, ORDEN_FLUJO_COTIZACION } from "@/lib/estados";
import FiltrosCotizaciones from "./FiltrosCotizaciones";
import CrearMenu from "./CrearMenu";
import TableroCotizaciones from "./TableroCotizaciones";

type Vista = "lista" | "cuadricula" | "board";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  horas_envio?: number | null;
  created_at: string;
  programador_id: string | null;
  programadores: { nombre: string } | null;
  proyecto_nombre?: string | null;
  tipo_precio?: string | null;
  monto_fijo?: number | null;
  estimacion_formulario_id?: string | null;
};

const estadosVisibles = [
  "por_estimar",
  "pendiente_revision_interna",
  "esperando_aprobacion",
  "cambios_solicitados",
  "enviada",
  "aprobada",
  "en_desarrollo",
  "en_espera_de_cobro",
  "pendiente_por_cobrar",
  "rechazada",
  "cobrada",
];

type Filtros = {
  q: string | null;
  estado: string | null;
  programador: string | null;
  proyecto: string | null;
  desde: string | null;
  hasta: string | null;
  archivadas: boolean;
};

async function getCotizaciones(filtros: Filtros): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();

  const selCompleto =
    "id, nombre, estado, horas_min, horas_max, horas_envio, created_at, programador_id, tipo_precio, monto_fijo, proyecto_nombre, estimacion_formulario_id, programadores(nombre)";
  const selSinProy = selCompleto.replace(", proyecto_nombre", "");
  const selSinFijo = selSinProy.replace(", tipo_precio, monto_fijo", "");
  const selBasico = selSinFijo.replace(", horas_envio", "");

  const aplicarFiltros = (qb: any) => {
    let q = qb;
    if (!filtros.archivadas) {
      if (filtros.estado) {
        q = q.eq("estado", filtros.estado);
      } else {
        q = q.in("estado", estadosVisibles);
      }
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

  // Trato resiliente con migraciones — cae a select más pequeño si la
  // columna no existe en el ambiente.
  const intentar = async (sel: string) => {
    const qb = supa
      .from("cotizaciones")
      .select(sel)
      .order("created_at", { ascending: false })
      .limit(300);
    return aplicarFiltros(qb);
  };

  let resp: any = await intentar(selCompleto);
  if (resp.error && /proyecto_nombre/i.test(resp.error.message)) {
    resp = await intentar(selSinProy);
  }
  if (resp.error && /(tipo_precio|monto_fijo)/i.test(resp.error.message)) {
    resp = await intentar(selSinFijo);
  }
  if (resp.error && /horas_envio/i.test(resp.error.message)) {
    resp = await intentar(selBasico);
  }
  if (resp.error) {
    console.error("[cotizaciones] error:", resp.error);
    return [];
  }
  const rows = (resp.data ?? []) as unknown as Row[];

  // Backfill proyecto_nombre desde la estimación vinculada cuando la
  // cotización no lo tiene guardado (cotizaciones viejas, antes del fix).
  const sinProyecto = rows.filter(
    (r) => !r.proyecto_nombre && (r as any).estimacion_formulario_id
  );
  if (sinProyecto.length > 0) {
    const estIds = Array.from(
      new Set(sinProyecto.map((r) => (r as any).estimacion_formulario_id))
    );
    const { data: ests } = await supa
      .from("estimaciones_formulario")
      .select("id, datos_raw")
      .in("id", estIds);
    const proyMap = new Map<string, string>();
    for (const e of (ests ?? []) as any[]) {
      const p = e.datos_raw?.proyecto_nombre;
      if (p) proyMap.set(e.id, p);
    }
    for (const r of rows) {
      if (!r.proyecto_nombre) {
        const ef = (r as any).estimacion_formulario_id;
        if (ef && proyMap.has(ef)) r.proyecto_nombre = proyMap.get(ef)!;
      }
    }
  }

  return rows;
}

async function getProgramadores(): Promise<{ id: string; nombre: string }[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("programadores")
    .select("id, nombre")
    .order("nombre", { ascending: true });
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
// las tarjetas con el mismo color elegido en el catálogo.
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

export default async function CotizacionesPage({
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
    vista?: string;
  };
}) {
  const vistaExplicita: Vista | null =
    searchParams.vista === "cuadricula"
      ? "cuadricula"
      : searchParams.vista === "board"
      ? "board"
      : searchParams.vista === "lista"
      ? "lista"
      : null;
  // Vista mostrada en el toggle (refleja desktop). Mobile usa cuadrícula por defecto.
  const vista: Vista = vistaExplicita ?? "board";
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

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Cotizaciones</h1>
          <p className="text-body text-text-secondary">
            {filtros.archivadas
              ? "Mostrando todas (incluye archivadas)"
              : "Activas únicamente"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <VistaToggle vista={vista} />
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

      <FiltrosCotizaciones
        programadores={programadores}
        proyectos={proyectos}
        actuales={filtros}
      />

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin cotizaciones que coincidan con los filtros.
        </div>
      ) : vistaExplicita ? (
        vistaExplicita === "board" ? (
          <TableroCotizaciones
            columnas={ORDEN_FLUJO_COTIZACION.filter((e) => e !== "archivada")}
            itemsIniciales={items}
            coloresProyecto={coloresProyecto}
          />
        ) : vistaExplicita === "cuadricula" ? (
          <CuadriculaCotizaciones items={items} />
        ) : (
          <ListaCotizaciones items={items} />
        )
      ) : (
        <>
          <div className="md:hidden">
            <CuadriculaCotizaciones items={items} />
          </div>
          <div className="hidden md:block">
            <TableroCotizaciones
              columnas={ORDEN_FLUJO_COTIZACION.filter((e) => e !== "archivada")}
              itemsIniciales={items}
              coloresProyecto={coloresProyecto}
            />
          </div>
        </>
      )}
    </>
  );
}

function ListaCotizaciones({ items }: { items: Row[] }) {
  return (
    <ul
      className="rounded-[14px] overflow-hidden border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header (desktop) */}
      <li
        className="hidden md:grid md:grid-cols-[1fr_160px_160px_120px_110px_36px] gap-3 px-4 py-2.5 text-overline text-text-tertiary"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <div>Nombre</div>
        <div>Programador</div>
        <div>Proyecto</div>
        <div>Estado</div>
        <div>Fecha</div>
        <div />
      </li>
      {items.map((it, i) => {
        const fijo = it.tipo_precio === "fijo";
        return (
          <li
            key={it.id}
            style={{
              borderTop: i === 0 ? "none" : "1px solid var(--border-faint)",
            }}
          >
            <Link
              href={`/panel/cotizaciones/${it.id}`}
              className="block hover:bg-[color:var(--bg-surface)] transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_120px_110px_36px] gap-3 px-5 py-3 items-center">
                {/* Nombre */}
                <div className="min-w-0">
                  <div className="text-body-medium text-text-primary break-words">
                    {it.nombre}
                  </div>
                  <div className="text-caption text-text-tertiary flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {fijo ? (
                      <span className="num-tabular inline-flex items-center gap-1">
                        <DollarSign size={11} strokeWidth={1.5} />
                        {it.monto_fijo != null ? fmtMxn(Number(it.monto_fijo)) : "—"}
                      </span>
                    ) : (
                      <span className="num-tabular inline-flex items-center gap-1">
                        <Clock size={11} strokeWidth={1.5} />
                        {it.horas_min}–{it.horas_max}h
                      </span>
                    )}
                    {/* En mobile el programador/proyecto/fecha también aquí */}
                    <span className="md:hidden">
                      {it.programadores?.nombre ?? "—"}
                    </span>
                    {it.proyecto_nombre && (
                      <span className="md:hidden">{it.proyecto_nombre}</span>
                    )}
                    <span className="md:hidden">{fmtFecha(it.created_at)}</span>
                  </div>
                </div>

                {/* Programador (desktop) */}
                <div className="hidden md:block text-caption text-text-secondary break-words">
                  {it.programadores?.nombre ?? "—"}
                </div>

                {/* Proyecto (desktop) */}
                <div className="hidden md:block text-caption text-text-secondary break-words">
                  {it.proyecto_nombre ?? "—"}
                </div>

                {/* Estado */}
                <div className="flex md:block">
                  <span className={`badge ${badgeEstado(it.estado)}`}>
                    {labelEstado(it.estado)}
                  </span>
                </div>

                {/* Fecha (desktop) */}
                <div className="hidden md:block text-caption text-text-tertiary num-tabular">
                  {fmtFecha(it.created_at)}
                </div>

                {/* Flecha (desktop) */}
                <div className="hidden md:flex justify-end text-text-tertiary">
                  ›
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CuadriculaCotizaciones({ items }: { items: Row[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      {items.map((it) => (
        <li key={it.id}>
          <TarjetaCotizacion it={it} />
        </li>
      ))}
    </ul>
  );
}

// Tarjeta reusada tanto en la vista cuadrícula como en el tablero (board).
function TarjetaCotizacion({ it }: { it: Row }) {
  const fijo = it.tipo_precio === "fijo";
  return (
    <Link
      href={`/panel/cotizaciones/${it.id}`}
      className="card card-hover space-y-3 block"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-body-medium text-text-primary break-words flex-1 min-w-0">
          {it.nombre}
        </h2>
        <span className={`badge ${badgeEstado(it.estado)} shrink-0`}>
          {labelEstado(it.estado)}
        </span>
      </div>
      <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <User size={12} strokeWidth={1.5} />
          {it.programadores?.nombre ?? "—"}
        </span>
        {fijo ? (
          <span className="num-tabular inline-flex items-center gap-1.5">
            <DollarSign size={12} strokeWidth={1.5} />
            {it.monto_fijo != null ? fmtMxn(Number(it.monto_fijo)) : "—"}
          </span>
        ) : (
          <span className="num-tabular inline-flex items-center gap-1.5">
            <Clock size={12} strokeWidth={1.5} />
            {it.horas_min}–{it.horas_max} h
          </span>
        )}
      </div>
      {it.proyecto_nombre && (
        <p className="text-caption text-text-tertiary">{it.proyecto_nombre}</p>
      )}
      <p className="text-caption text-text-tertiary num-tabular">
        {fmtFecha(it.created_at)}
      </p>
    </Link>
  );
}
