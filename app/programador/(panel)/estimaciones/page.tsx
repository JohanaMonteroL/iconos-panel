import Link from "next/link";
import { Plus, Clock, ExternalLink, FileCheck, Sparkles } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireProgramador } from "@/lib/programador/auth";
import { formatFechaCorta } from "@/lib/dates";
import FiltrosEstimaciones from "./FiltrosEstimaciones";

export const dynamic = "force-dynamic";

type EstimacionRow = {
  id: string;
  created_at: string;
  estado: string;
  cotizacion_ref: string | null;
  datos_raw: {
    nombre_solicitud?: string;
    notas?: string | null;
    proyecto_nombre?: string | null;
    buffer_porcentaje?: number;
    envio?: { horas?: number } | null;
    tareas?: Array<{ hrs_min: number; hrs_max: number }>;
  };
};

type CotizacionLite = {
  id: string;
  estado: string;
  horas_envio: number | null;
  horas_min: number;
  horas_max: number;
  clickup_ticket_id: string | null;
};

async function getData(
  programadorId: string,
  query: { busqueda?: string; estado?: string }
): Promise<{
  estimaciones: EstimacionRow[];
  cotsByEstimacionId: Map<string, CotizacionLite>;
}> {
  const supa = createSupabaseServiceClient();

  const { data: ests } = await supa
    .from("estimaciones_formulario")
    .select("id, created_at, estado, cotizacion_ref, datos_raw")
    .eq("programador_id", programadorId)
    .order("created_at", { ascending: false })
    .limit(300);
  let estimaciones = (ests ?? []) as EstimacionRow[];

  // Buscar cotizaciones referenciadas, para enriquecer las cards con estado
  // de cotización + ticket JIRA si lo hay.
  const cotIds = estimaciones
    .map((e) => e.cotizacion_ref)
    .filter((x): x is string => !!x);
  const cotsByEstimacionId = new Map<string, CotizacionLite>();

  if (cotIds.length > 0) {
    const sel =
      "id, estado, horas_envio, horas_min, horas_max, clickup_ticket_id, estimacion_formulario_id, jira_ticket_ids";
    const selSinHorasEnvio = sel.replace("horas_envio, ", "");
    let resp: { data: any; error: any } = await supa
      .from("cotizaciones")
      .select(sel)
      .in("id", cotIds);
    if (resp.error && /horas_envio/i.test(resp.error.message)) {
      resp = await supa
        .from("cotizaciones")
        .select(selSinHorasEnvio)
        .in("id", cotIds);
    }
    for (const c of (resp.data ?? []) as any[]) {
      if (c.estimacion_formulario_id) {
        cotsByEstimacionId.set(c.estimacion_formulario_id, c as CotizacionLite);
      }
    }
  }

  // Filtros opcionales (en memoria — el set ya es chico).
  // Trabajamos sobre el ESTADO EFECTIVO (el de la cotización si existe, si
  // no el de la estimación) para que las archivadas/aprobadas también
  // matcheen aunque la estimación origen siga en "procesada_ia".
  if (query.estado) {
    const target = query.estado;
    estimaciones = estimaciones.filter((e) => {
      const cot = cotsByEstimacionId.get(e.id);
      const efectivo = cot?.estado ?? e.estado;
      // Agrupamos descartada (estimación) y archivada (cotización) bajo
      // el mismo filtro porque ambas significan "ya no va".
      if (target === "descartada") {
        return efectivo === "descartada" || efectivo === "archivada";
      }
      if (target === "procesada_ia") {
        return efectivo === "procesada_ia" || efectivo === "en_revision";
      }
      if (target === "esperando_aprobacion") {
        return (
          efectivo === "esperando_aprobacion" ||
          efectivo === "pendiente_revisar"
        );
      }
      return efectivo === target;
    });
  }
  if (query.busqueda) {
    const term = query.busqueda.trim().toLowerCase();
    estimaciones = estimaciones.filter((e) => {
      const txt = JSON.stringify(e.datos_raw ?? {}).toLowerCase();
      return txt.includes(term);
    });
  }

  return { estimaciones, cotsByEstimacionId };
}

import { labelEstado, badgeEstado } from "@/lib/estados";

function totalHorasOriginal(
  tareas?: Array<{ hrs_min: number; hrs_max: number }>
): { min: number; max: number } {
  if (!tareas) return { min: 0, max: 0 };
  return tareas.reduce(
    (acc, t) => ({
      min: acc.min + (t.hrs_min || 0),
      max: acc.max + (t.hrs_max || 0),
    }),
    { min: 0, max: 0 }
  );
}

export default async function MisEstimacionesPage({
  searchParams,
}: {
  searchParams: { estado?: string; q?: string };
}) {
  const p = (await requireProgramador())!;
  const { estimaciones, cotsByEstimacionId } = await getData(p.id, {
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

      {estimaciones.length === 0 ? (
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
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {estimaciones.map((it) => {
            const totalOrig = totalHorasOriginal(it.datos_raw?.tareas);
            const numTareas = it.datos_raw?.tareas?.length ?? 0;
            const buffer = it.datos_raw?.buffer_porcentaje ?? 0;

            // Si tiene cotización, el estado y horas finales vienen de ahí.
            const cot = cotsByEstimacionId.get(it.id);
            const estadoEfectivo = cot?.estado ?? it.estado;
            const horasFinales =
              cot?.horas_envio ??
              (it.datos_raw?.envio?.horas ?? null);

            const clickupUrl = cot?.clickup_ticket_id
              ? `https://app.clickup.com/t/${cot.clickup_ticket_id}`
              : null;

            return (
              <li key={it.id}>
                <Link
                  href={`/programador/estimaciones/${it.id}`}
                  className="card hover:border-border-strong transition-colors space-y-3 block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-body-medium text-text-primary line-clamp-2 min-w-0 flex-1">
                      {it.datos_raw?.nombre_solicitud || "(sin nombre)"}
                    </h2>
                    <span className={`badge ${badgeEstado(estadoEfectivo)}`}>
                      {labelEstado(estadoEfectivo)}
                    </span>
                  </div>

                  <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
                    {it.datos_raw?.proyecto_nombre && (
                      <span>{it.datos_raw.proyecto_nombre}</span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <FileCheck size={12} strokeWidth={1.5} />
                      {numTareas} tarea{numTareas === 1 ? "" : "s"}
                    </span>
                    <span className="num-tabular inline-flex items-center gap-1.5">
                      <Clock size={12} strokeWidth={1.5} />
                      {totalOrig.min}–{totalOrig.max}h
                    </span>
                    {buffer > 0 && (
                      <span className="num-tabular">+{buffer}% buffer</span>
                    )}
                  </div>

                  {horasFinales != null && horasFinales > 0 && (
                    <div
                      className="rounded-[8px] p-2 text-caption num-tabular flex items-center gap-2"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <Sparkles size={12} strokeWidth={1.5} />
                      <span>
                        <strong className="text-text-primary">{horasFinales}h</strong>{" "}
                        enviadas al jefe
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-caption text-text-tertiary">
                    <span>{formatFechaCorta(it.created_at)}</span>
                    {clickupUrl && (
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink size={12} strokeWidth={1.5} />
                        Ticket creado
                      </span>
                    )}
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
