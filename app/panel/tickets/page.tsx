import Link from "next/link";
import { ExternalLink, Plus, Tag, User, Clock } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta } from "@/lib/dates";
import FiltrosTickets from "./FiltrosTickets";

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
  searchParams: { tipo?: string; proyecto?: string; asignado?: string };
}) {
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
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it) => (
            <li
              key={it.id}
              className="card hover:border-border-strong transition-colors space-y-3"
            >
              <Link
                href={`/panel/tickets/${it.id}`}
                className="block space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-caption text-text-tertiary num-tabular mb-1 flex items-center gap-2 flex-wrap">
                      <span>{it.jira_key}</span>
                      {it.cotizacion_ref && (
                        <span className="badge badge-info">Desde cotización</span>
                      )}
                    </div>
                    <h2 className="text-body-medium text-text-primary line-clamp-2">
                      {it.titulo}
                    </h2>
                  </div>
                  <span className={`badge ${TIPO_BADGE[it.tipo] ?? "badge-neutral"}`}>
                    {TIPO_LABEL[it.tipo] ?? it.tipo}
                  </span>
                </div>

                <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <User size={12} strokeWidth={1.5} />
                    {it.asignado_nombre}
                  </span>
                  {it.horas_estimadas != null && (
                    <span className="num-tabular inline-flex items-center gap-1.5">
                      <Clock size={12} strokeWidth={1.5} />
                      {it.horas_estimadas}h
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1.5 num-tabular"
                    style={{ color: PRIORIDAD_COLOR[it.prioridad] }}
                  >
                    ● {PRIORIDAD_LABEL[it.prioridad] ?? it.prioridad}
                  </span>
                  {it.sub_tipo && (
                    <span className="inline-flex items-center gap-1.5">
                      <Tag size={12} strokeWidth={1.5} />
                      {it.sub_tipo}
                    </span>
                  )}
                </div>

                <div className="text-caption text-text-tertiary flex items-center justify-between gap-3 flex-wrap">
                  <span className="truncate min-w-0">
                    {it.proyecto_jira_nombre}
                    {it.carril ? ` · ${it.carril}` : ""}
                  </span>
                  <span className="whitespace-nowrap">
                    {formatFechaCorta(it.created_at)}
                  </span>
                </div>
              </Link>

              <a
                href={it.jira_url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-sm w-full justify-center"
              >
                <ExternalLink size={14} strokeWidth={1.75} />
                <span>Abrir en JIRA</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
