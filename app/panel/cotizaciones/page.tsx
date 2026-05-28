import Link from "next/link";
import { Clock, ExternalLink, Plus, DollarSign, User } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import VistaToggle from "@/components/ui/VistaToggle";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta as fmtFecha } from "@/lib/dates";
import { labelEstado, badgeEstado } from "@/lib/estados";
import FiltrosCotizaciones from "./FiltrosCotizaciones";

type Vista = "lista" | "cuadricula";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  horas_envio?: number | null;
  created_at: string;
  clickup_ticket_id: string | null;
  programador_id: string | null;
  programadores: { nombre: string } | null;
  proyecto_nombre?: string | null;
  tipo_precio?: string | null;
  monto_fijo?: number | null;
  estimacion_formulario_id?: string | null;
};

const estadosVisibles = [
  "pendiente_revisar",
  "esperando_aprobacion",
  "aprobada",
  "cambios_solicitados",
  "aprobado_cliente",
  "enviada_cliente",
  "en_desarrollo",
  "finalizado",
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
    "id, nombre, estado, horas_min, horas_max, horas_envio, created_at, clickup_ticket_id, programador_id, tipo_precio, monto_fijo, proyecto_nombre, estimacion_formulario_id, programadores(nombre)";
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

async function getProyectos(): Promise<string[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("cotizaciones")
    .select("proyecto_nombre")
    .not("proyecto_nombre", "is", null)
    .limit(1000);
  if (!data) return [];
  const set = new Set<string>();
  for (const r of data as any[]) {
    if (r.proyecto_nombre) set.add(r.proyecto_nombre);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
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
      : searchParams.vista === "lista"
      ? "lista"
      : null;
  // Vista mostrada en el toggle (refleja desktop). Mobile usa cuadrícula por defecto.
  const vista: Vista = vistaExplicita ?? "lista";
  const filtros: Filtros = {
    archivadas: searchParams.archivadas === "1",
    q: searchParams.q ?? null,
    estado: searchParams.estado ?? null,
    programador: searchParams.programador ?? null,
    proyecto: searchParams.proyecto ?? null,
    desde: searchParams.desde ?? null,
    hasta: searchParams.hasta ?? null,
  };

  const [items, programadores, proyectos] = await Promise.all([
    getCotizaciones(filtros),
    getProgramadores(),
    getProyectos(),
  ]);

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
          <Link href="/panel/cotizaciones/nueva" className="btn-primary">
            <Plus size={16} strokeWidth={1.75} />
            <span>Cotización rápida</span>
          </Link>
        </div>
      </header>

      <div
        className="inline-flex gap-1 p-1 rounded-lg"
        style={{ background: "var(--bg-overlay)" }}
      >
        <Link
          href={`/panel/cotizaciones${searchParams.q ? `?q=${searchParams.q}` : ""}`}
          className={`btn-sm ${!filtros.archivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Activas
        </Link>
        <Link
          href="/panel/cotizaciones?archivadas=1"
          className={`btn-sm ${filtros.archivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Historial
        </Link>
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
        vistaExplicita === "cuadricula" ? (
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
            <ListaCotizaciones items={items} />
          </div>
        </>
      )}
    </>
  );
}

function ListaCotizaciones({ items }: { items: Row[] }) {
  return (
    <ul
      className="rounded-[12px] overflow-hidden border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Header (desktop) */}
      <li
        className="hidden md:grid md:grid-cols-[1fr_160px_160px_120px_110px_36px] gap-3 px-5 py-2 text-overline text-text-tertiary"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
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
              borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
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
                    {it.clickup_ticket_id && (
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink size={11} strokeWidth={1.5} />
                        ClickUp
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
    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((it) => {
        const fijo = it.tipo_precio === "fijo";
        return (
          <li key={it.id}>
            <Link
              href={`/panel/cotizaciones/${it.id}`}
              className="card hover:border-border-strong transition-colors space-y-3 block"
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
                {it.clickup_ticket_id && (
                  <span className="inline-flex items-center gap-1.5">
                    <ExternalLink size={12} strokeWidth={1.5} />
                    ClickUp
                  </span>
                )}
              </div>
              {it.proyecto_nombre && (
                <p className="text-caption text-text-tertiary">
                  {it.proyecto_nombre}
                </p>
              )}
              <p className="text-caption text-text-tertiary num-tabular">
                {fmtFecha(it.created_at)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
