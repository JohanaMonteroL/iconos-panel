import Link from "next/link";
import { Plus, Tag, User, Clock } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import VistaToggle from "@/components/ui/VistaToggle";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta } from "@/lib/dates";
import FiltrosTickets from "./FiltrosTickets";

type Vista = "lista" | "cuadricula";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  jira_key: string;
  jira_url: string;
  titulo: string;
  tipo: string;
  sub_tipo: string | null;
  prioridad: string;
  horas_estimadas: number | null;
  asignado_jira_id: string;
  asignado_nombre: string;
  proyecto_jira_key: string;
  proyecto_jira_nombre: string;
  carril: string | null;
  cotizacion_ref: string | null;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  estimacion: "Estimación",
  desarrollo: "Desarrollo",
  soporte: "Soporte",
  investigacion: "Investigación",
};

const TIPO_BADGE: Record<string, string> = {
  estimacion: "badge-info",
  desarrollo: "badge-neutral",
  soporte: "badge-warning",
  investigacion: "badge-success",
};

const PRIORIDAD_COLOR: Record<string, string> = {
  highest: "#DC2626",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#16A34A",
  lowest: "#6B7280",
};

const PRIORIDAD_LABEL: Record<string, string> = {
  highest: "Más alta",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  lowest: "Más baja",
};

async function getTickets(filtros: {
  tipo?: string;
  proyecto?: string;
  asignado?: string;
}): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const supa = createSupabaseServiceClient();
    let q = supa
      .from("tickets_jira")
      .select(
        "id, jira_key, jira_url, titulo, tipo, sub_tipo, prioridad, horas_estimadas, asignado_jira_id, asignado_nombre, proyecto_jira_key, proyecto_jira_nombre, carril, cotizacion_ref, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
    if (filtros.proyecto) q = q.eq("proyecto_jira_key", filtros.proyecto);
    if (filtros.asignado) q = q.eq("asignado_jira_id", filtros.asignado);
    const { data, error } = await q;
    if (error) {
      console.error("[tickets list] error:", error);
      return [];
    }
    return (data ?? []) as Row[];
  } catch {
    return [];
  }
}

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams: { tipo?: string; proyecto?: string; asignado?: string; vista?: string };
}) {
  const vistaExplicita: Vista | null =
    searchParams.vista === "cuadricula"
      ? "cuadricula"
      : searchParams.vista === "lista"
      ? "lista"
      : null;
  const vista: Vista = vistaExplicita ?? "lista";
  const items = await getTickets({
    tipo: searchParams.tipo,
    proyecto: searchParams.proyecto,
    asignado: searchParams.asignado,
  });

  // Opciones para los selects de filtro, derivadas del set completo de la
  // BD (no del set filtrado). Una segunda query barata.
  const supa = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceClient()
    : null;
  let opcionesProy: { key: string; nombre: string }[] = [];
  let opcionesAsig: { id: string; nombre: string }[] = [];
  if (supa) {
    const { data } = await supa
      .from("tickets_jira")
      .select(
        "proyecto_jira_key, proyecto_jira_nombre, asignado_jira_id, asignado_nombre"
      )
      .limit(1000);
    if (data) {
      opcionesProy = Array.from(
        new Map(
          data.map((d: any) => [
            d.proyecto_jira_key,
            { key: d.proyecto_jira_key, nombre: d.proyecto_jira_nombre },
          ])
        ).values()
      ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      opcionesAsig = Array.from(
        new Map(
          data.map((d: any) => [
            d.asignado_jira_id,
            { id: d.asignado_jira_id, nombre: d.asignado_nombre },
          ])
        ).values()
      ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }
  }

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Tickets</h1>
          <p className="text-body text-text-secondary">
            Tickets de JIRA creados desde el panel. La fuente de verdad es JIRA;
            aquí los rastreamos para edición rápida.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <VistaToggle vista={vista} />
          <AutoRefresh intervalSeconds={20} />
          <Link href="/panel/tickets/nuevo" className="btn-primary">
            <Plus size={16} strokeWidth={1.75} />
            <span>Nuevo ticket</span>
          </Link>
        </div>
      </header>

      <FiltrosTickets
        proyectos={opcionesProy}
        asignados={opcionesAsig}
        actuales={{
          tipo: searchParams.tipo ?? null,
          proyecto: searchParams.proyecto ?? null,
          asignado: searchParams.asignado ?? null,
        }}
      />

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10 space-y-3">
          <p>Sin tickets que coincidan con los filtros.</p>
          <Link href="/panel/tickets/nuevo" className="btn-secondary inline-flex">
            <Plus size={16} strokeWidth={1.75} />
            <span>Nuevo ticket</span>
          </Link>
        </div>
      ) : vistaExplicita === "cuadricula" ? (
        <CuadriculaTickets items={items} />
      ) : vistaExplicita === "lista" ? (
        <ListaTickets items={items} />
      ) : (
        <>
          <div className="md:hidden">
            <CuadriculaTickets items={items} />
          </div>
          <div className="hidden md:block">
            <ListaTickets items={items} />
          </div>
        </>
      )}
    </>
  );
}

function ListaTickets({ items }: { items: Row[] }) {
  return (
    <ul
      className="rounded-[12px] overflow-hidden border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
          <li
            className="hidden md:grid md:grid-cols-[110px_1fr_160px_140px_120px_110px_36px] gap-3 px-5 py-2 text-overline text-text-tertiary"
            style={{
              background: "var(--bg-surface)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div>Key</div>
            <div>Título</div>
            <div>Asignado</div>
            <div>Proyecto</div>
            <div>Tipo</div>
            <div>Fecha</div>
            <div />
          </li>
          {items.map((it, i) => (
            <li
              key={it.id}
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
              }}
            >
              <Link
                href={`/panel/tickets/${it.id}`}
                className="block hover:bg-[color:var(--bg-surface)] transition-colors"
              >
                <div className="grid grid-cols-1 md:grid-cols-[110px_1fr_160px_140px_120px_110px_36px] gap-3 px-5 py-3 items-center">
                  {/* Key + cotización badge */}
                  <div className="text-caption num-tabular text-text-tertiary flex items-center gap-2 flex-wrap">
                    <span>{it.jira_key}</span>
                    {it.cotizacion_ref && (
                      <span className="badge badge-info md:hidden">
                        Cotización
                      </span>
                    )}
                  </div>

                  {/* Título + meta */}
                  <div className="min-w-0">
                    <div className="text-body-medium text-text-primary break-words">
                      {it.titulo}
                    </div>
                    <div className="text-caption text-text-tertiary flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span
                        className="inline-flex items-center gap-1 num-tabular"
                        style={{ color: PRIORIDAD_COLOR[it.prioridad] }}
                      >
                        ● {PRIORIDAD_LABEL[it.prioridad] ?? it.prioridad}
                      </span>
                      {it.horas_estimadas != null && (
                        <span className="num-tabular inline-flex items-center gap-1">
                          <Clock size={11} strokeWidth={1.5} />
                          {it.horas_estimadas}h
                        </span>
                      )}
                      {it.sub_tipo && (
                        <span className="inline-flex items-center gap-1">
                          <Tag size={11} strokeWidth={1.5} />
                          {it.sub_tipo}
                        </span>
                      )}
                      {/* Mobile: asignado / proyecto / fecha en línea */}
                      <span className="md:hidden inline-flex items-center gap-1">
                        <User size={11} strokeWidth={1.5} />
                        {it.asignado_nombre}
                      </span>
                      <span className="md:hidden">
                        {it.proyecto_jira_nombre}
                      </span>
                      <span className="md:hidden">
                        {formatFechaCorta(it.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Asignado (desktop) */}
                  <div className="hidden md:block text-caption text-text-secondary break-words">
                    {it.asignado_nombre}
                  </div>

                  {/* Proyecto (desktop) */}
                  <div className="hidden md:block text-caption text-text-secondary break-words">
                    {it.proyecto_jira_nombre}
                    {it.carril && (
                      <span className="text-text-tertiary">
                        {" · "}
                        {it.carril}
                      </span>
                    )}
                  </div>

                  {/* Tipo */}
                  <div className="flex md:block">
                    <span
                      className={`badge ${
                        TIPO_BADGE[it.tipo] ?? "badge-neutral"
                      }`}
                    >
                      {TIPO_LABEL[it.tipo] ?? it.tipo}
                    </span>
                  </div>

                  {/* Fecha (desktop) */}
                  <div className="hidden md:block text-caption text-text-tertiary num-tabular">
                    {formatFechaCorta(it.created_at)}
                  </div>

                  {/* Indicador (desktop) */}
                  <div className="hidden md:flex justify-end text-text-tertiary">
                    ›
                  </div>
                </div>
              </Link>
            </li>
          ))}
    </ul>
  );
}

function CuadriculaTickets({ items }: { items: Row[] }) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((it) => (
        <li key={it.id}>
          <Link
            href={`/panel/tickets/${it.id}`}
            className="card hover:border-border-strong transition-colors space-y-3 block"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-caption num-tabular text-text-tertiary">
                  {it.jira_key}
                </div>
                <h2 className="text-body-medium text-text-primary break-words">
                  {it.titulo}
                </h2>
              </div>
              <span
                className={`badge ${TIPO_BADGE[it.tipo] ?? "badge-neutral"} shrink-0`}
              >
                {TIPO_LABEL[it.tipo] ?? it.tipo}
              </span>
            </div>
            <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
              <span
                className="inline-flex items-center gap-1 num-tabular"
                style={{ color: PRIORIDAD_COLOR[it.prioridad] }}
              >
                ● {PRIORIDAD_LABEL[it.prioridad] ?? it.prioridad}
              </span>
              {it.horas_estimadas != null && (
                <span className="num-tabular inline-flex items-center gap-1">
                  <Clock size={12} strokeWidth={1.5} />
                  {it.horas_estimadas}h
                </span>
              )}
              {it.sub_tipo && (
                <span className="inline-flex items-center gap-1">
                  <Tag size={12} strokeWidth={1.5} />
                  {it.sub_tipo}
                </span>
              )}
            </div>
            <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <User size={12} strokeWidth={1.5} />
                {it.asignado_nombre}
              </span>
              <span>{it.proyecto_jira_nombre}</span>
              {it.carril && <span>· {it.carril}</span>}
            </div>
            <p className="text-caption text-text-tertiary num-tabular">
              {formatFechaCorta(it.created_at)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
