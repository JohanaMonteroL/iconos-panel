// Vista angosta sobre `cotizaciones`, filtrada a los estados de "etapa
// temprana" (por_estimar / pendiente_revision_interna). Ya no hay tabla ni
// estado propios de "estimación" — todo vive en cotizaciones desde que nace.
// Enlaza al mismo detalle que el resto del flujo: /panel/cotizaciones/[id].

import Link from "next/link";
import { Clock, FileCheck, User } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import VistaToggle from "@/components/ui/VistaToggle";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta } from "@/lib/dates";
import { labelEstado, badgeEstado, ESTADOS_ESTIMACION_ACTIVA } from "@/lib/estados";
import NuevaEstimacionButton from "./NuevaEstimacionButton";

type Vista = "lista" | "cuadricula";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  created_at: string;
  proyecto_nombre: string | null;
  programadores: { nombre: string } | null;
  tareas_estimacion: { id: string }[] | null;
};

async function getEstimaciones(): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("cotizaciones")
    .select(
      "id, nombre, estado, horas_min, horas_max, created_at, proyecto_nombre, programadores(nombre), tareas_estimacion(id)"
    )
    .in("estado", ESTADOS_ESTIMACION_ACTIVA)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[estimaciones] error:", error);
    return [];
  }
  return (data ?? []) as unknown as Row[];
}

export default async function EstimacionesPage({
  searchParams,
}: {
  searchParams: { vista?: string };
}) {
  const vistaExplicita: Vista | null =
    searchParams.vista === "cuadricula"
      ? "cuadricula"
      : searchParams.vista === "lista"
      ? "lista"
      : null;
  const vista: Vista = vistaExplicita ?? "lista";

  const items = await getEstimaciones();

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Estimaciones</h1>
          <p className="text-body text-text-secondary">
            Solicitudes que aún no se han enviado a aprobación — recién
            llegadas de un programador o creadas manualmente.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <VistaToggle vista={vista} conBoard={false} />
          <AutoRefresh intervalSeconds={10} />
          <NuevaEstimacionButton />
        </div>
      </header>

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10 space-y-3">
          <p>Sin estimaciones pendientes de revisión interna.</p>
          <div className="flex justify-center">
            <NuevaEstimacionButton />
          </div>
        </div>
      ) : vista === "cuadricula" ? (
        <CuadriculaEstimaciones items={items} />
      ) : (
        <ListaEstimaciones items={items} />
      )}
    </>
  );
}

function ListaEstimaciones({ items }: { items: Row[] }) {
  return (
    <ul
      className="rounded-[12px] overflow-hidden border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
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
        const nTareas = it.tareas_estimacion?.length ?? 0;
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
                <div className="min-w-0">
                  <div className="text-body-medium text-text-primary break-words">
                    {it.nombre || "(sin nombre)"}
                  </div>
                  <div className="text-caption text-text-tertiary flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <FileCheck size={11} strokeWidth={1.5} />
                      {nTareas} tarea{nTareas === 1 ? "" : "s"}
                    </span>
                    <span className="num-tabular inline-flex items-center gap-1">
                      <Clock size={11} strokeWidth={1.5} />
                      {it.horas_min}–{it.horas_max}h
                    </span>
                    <span className="md:hidden">
                      {it.programadores?.nombre ?? "—"}
                    </span>
                    {it.proyecto_nombre && (
                      <span className="md:hidden">{it.proyecto_nombre}</span>
                    )}
                    <span className="md:hidden">
                      {formatFechaCorta(it.created_at)}
                    </span>
                  </div>
                </div>

                <div className="hidden md:block text-caption text-text-secondary break-words">
                  {it.programadores?.nombre ?? "—"}
                </div>

                <div className="hidden md:block text-caption text-text-secondary break-words">
                  {it.proyecto_nombre ?? "—"}
                </div>

                <div className="flex md:block">
                  <span className={`badge ${badgeEstado(it.estado)}`}>
                    {labelEstado(it.estado)}
                  </span>
                </div>

                <div className="hidden md:block text-caption text-text-tertiary num-tabular">
                  {formatFechaCorta(it.created_at)}
                </div>

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

function CuadriculaEstimaciones({ items }: { items: Row[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      {items.map((it) => {
        const nTareas = it.tareas_estimacion?.length ?? 0;
        return (
          <li key={it.id}>
            <Link
              href={`/panel/cotizaciones/${it.id}`}
              className="card hover:border-border-strong transition-colors space-y-3 block"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-body-medium text-text-primary break-words flex-1 min-w-0">
                  {it.nombre || "(sin nombre)"}
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
                <span className="inline-flex items-center gap-1.5">
                  <FileCheck size={12} strokeWidth={1.5} />
                  {nTareas} tarea{nTareas === 1 ? "" : "s"}
                </span>
                <span className="num-tabular inline-flex items-center gap-1.5">
                  <Clock size={12} strokeWidth={1.5} />
                  {it.horas_min}–{it.horas_max} h
                </span>
              </div>
              {it.proyecto_nombre && (
                <p className="text-caption text-text-tertiary">
                  {it.proyecto_nombre}
                </p>
              )}
              <p className="text-caption text-text-tertiary num-tabular">
                {formatFechaCorta(it.created_at)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
