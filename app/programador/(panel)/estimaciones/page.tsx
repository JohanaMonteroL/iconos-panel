// Lista de "mis estimaciones" del programador — desde la fusión
// Cotizaciones + Estimaciones, todo vive directo en `cotizaciones`
// (programador_id), sin el join intermedio contra estimaciones_formulario
// que existía antes.

import Link from "next/link";
import { Plus, Clock, FileCheck } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireProgramador } from "@/lib/programador/auth";
import { formatFechaCorta } from "@/lib/dates";
import { labelEstado, badgeEstado } from "@/lib/estados";
import FiltrosEstimaciones from "./FiltrosEstimaciones";

export const dynamic = "force-dynamic";

type CotizacionRow = {
  id: string;
  created_at: string;
  estado: string;
  nombre: string;
  proyecto_nombre: string | null;
  horas_min: number;
  horas_max: number;
  horas_envio: number | null;
  buffer_porcentaje: number | null;
  tareas_estimacion: { id: string }[] | null;
};

async function getData(
  programadorId: string,
  query: { busqueda?: string; estado?: string }
): Promise<CotizacionRow[]> {
  const supa = createSupabaseServiceClient();

  let q = supa
    .from("cotizaciones")
    .select(
      "id, created_at, estado, nombre, proyecto_nombre, horas_min, horas_max, horas_envio, buffer_porcentaje, tareas_estimacion(id)"
    )
    .eq("programador_id", programadorId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (query.estado) q = q.eq("estado", query.estado);
  if (query.busqueda) q = q.ilike("nombre", `%${query.busqueda}%`);

  const { data, error } = await q;
  if (error) {
    console.error("[programador/estimaciones] error:", error);
    return [];
  }
  return (data ?? []) as unknown as CotizacionRow[];
}

export default async function MisEstimacionesPage({
  searchParams,
}: {
  searchParams: { estado?: string; q?: string };
}) {
  const p = (await requireProgramador())!;
  const items = await getData(p.id, {
    estado: searchParams.estado,
    busqueda: searchParams.q,
  });

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Mis estimaciones</h1>
          <p className="text-body text-text-secondary">
            Todas las que has enviado, con su estatus actual.
          </p>
        </div>
        <Link href="/programador/estimaciones/nueva" className="btn-primary">
          <Plus size={16} strokeWidth={1.75} />
          <span>Nueva estimación</span>
        </Link>
      </header>

      <FiltrosEstimaciones
        actuales={{
          estado: searchParams.estado ?? null,
          q: searchParams.q ?? null,
        }}
      />

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10 space-y-3">
          <p>
            Sin estimaciones que coincidan con los filtros. Crea una nueva o
            limpia los filtros.
          </p>
          <Link href="/programador/estimaciones/nueva" className="btn-secondary inline-flex">
            <Plus size={16} strokeWidth={1.75} />
            <span>Nueva estimación</span>
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {items.map((it) => {
            const numTareas = it.tareas_estimacion?.length ?? 0;
            const buffer = it.buffer_porcentaje ?? 0;

            return (
              <li key={it.id}>
                <Link
                  href={`/programador/estimaciones/${it.id}`}
                  className="card hover:border-border-strong transition-colors space-y-3 block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-body-medium text-text-primary line-clamp-2 min-w-0 flex-1">
                      {it.nombre || "(sin nombre)"}
                    </h2>
                    <span className={`badge ${badgeEstado(it.estado)}`}>
                      {labelEstado(it.estado)}
                    </span>
                  </div>

                  <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
                    {it.proyecto_nombre && <span>{it.proyecto_nombre}</span>}
                    <span className="inline-flex items-center gap-1.5">
                      <FileCheck size={12} strokeWidth={1.5} />
                      {numTareas} tarea{numTareas === 1 ? "" : "s"}
                    </span>
                    <span className="num-tabular inline-flex items-center gap-1.5">
                      <Clock size={12} strokeWidth={1.5} />
                      {it.horas_min}–{it.horas_max}h
                    </span>
                    {buffer > 0 && (
                      <span className="num-tabular">+{buffer}% buffer</span>
                    )}
                  </div>

                  {it.horas_envio != null && it.horas_envio > 0 && (
                    <div
                      className="rounded-[8px] p-2 text-caption num-tabular flex items-center gap-2"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span>
                        <strong className="text-text-primary">
                          {it.horas_envio}h
                        </strong>{" "}
                        enviadas al jefe
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-caption text-text-tertiary">
                    <span>{formatFechaCorta(it.created_at)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
