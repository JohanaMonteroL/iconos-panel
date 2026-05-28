import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Send } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireProgramador } from "@/lib/programador/auth";
import { formatFechaLarga } from "@/lib/dates";
import ToggleOriginalLimpia from "./ToggleOriginalLimpia";

export const dynamic = "force-dynamic";

type Tarea = {
  nombre: string;
  descripcion: string;
  hrs_min: number;
  hrs_max: number;
};

type EstimacionDetalle = {
  id: string;
  created_at: string;
  estado: string;
  cotizacion_ref: string | null;
  programador_id: string;
  datos_raw: {
    nombre_solicitud?: string;
    notas?: string | null;
    proyecto_nombre?: string | null;
    buffer_porcentaje?: number;
    envio?: { horas?: number; tipo?: string } | null;
    tareas?: Tarea[];
  };
  datos_limpios: {
    nombre_solicitud?: string;
    tareas?: Tarea[];
  } | null;
};

type CotizacionLite = {
  id: string;
  estado: string;
  horas_envio: number | null;
  horas_min: number;
  horas_max: number;
  clickup_ticket_id: string | null;
  jefe_aprobacion_recibida_at: string | null;
};

async function getEstimacion(
  id: string,
  programadorId: string
): Promise<{
  est: EstimacionDetalle;
  cot: CotizacionLite | null;
  tareasFinales: Tarea[] | null;
} | null> {
  const supa = createSupabaseServiceClient();
  const { data: est } = await supa
    .from("estimaciones_formulario")
    .select(
      "id, created_at, estado, cotizacion_ref, programador_id, datos_raw, datos_limpios"
    )
    .eq("id", id)
    .maybeSingle();
  if (!est || est.programador_id !== programadorId) return null;

  let cot: CotizacionLite | null = null;
  let tareasFinales: Tarea[] | null = null;
  if (est.cotizacion_ref) {
    const sel =
      "id, estado, horas_envio, horas_min, horas_max, clickup_ticket_id, jefe_aprobacion_recibida_at";
    const selSinHorasEnvio = sel.replace("horas_envio, ", "");
    let resp: { data: any; error: any } = await supa
      .from("cotizaciones")
      .select(sel)
      .eq("id", est.cotizacion_ref)
      .maybeSingle();
    if (resp.error && /horas_envio/i.test(resp.error.message)) {
      resp = await supa
        .from("cotizaciones")
        .select(selSinHorasEnvio)
        .eq("id", est.cotizacion_ref)
        .maybeSingle();
    }
    cot = (resp.data as CotizacionLite) ?? null;

    // Las tareas FINALES (las que Johana realmente envió) están en
    // tareas_estimacion ligadas a la cotización. Estas reflejan los
    // cambios manuales que ella hizo después del paso por la IA.
    const { data: tFin } = await supa
      .from("tareas_estimacion")
      .select(
        "orden, nombre_limpio, nombre_original, descripcion_limpia, descripcion_original, hrs_min, hrs_max"
      )
      .eq("cotizacion_id", est.cotizacion_ref)
      .order("orden", { ascending: true });
    if (tFin && tFin.length > 0) {
      tareasFinales = tFin.map((t: any) => ({
        nombre: t.nombre_limpio || t.nombre_original || "",
        descripcion: t.descripcion_limpia || t.descripcion_original || "",
        hrs_min: Number(t.hrs_min) || 0,
        hrs_max: Number(t.hrs_max) || 0,
      }));
    }
  }

  return { est: est as EstimacionDetalle, cot, tareasFinales };
}

import { labelEstado, badgeEstado } from "@/lib/estados";

function totales(tareas?: Tarea[]) {
  if (!tareas) return { min: 0, max: 0, pert: 0 };
  const min = tareas.reduce((s, t) => s + (t.hrs_min || 0), 0);
  const max = tareas.reduce((s, t) => s + (t.hrs_max || 0), 0);
  const pert = Math.round(((min + max) / 2) * 10) / 10;
  return { min, max, pert };
}

export default async function EstimacionDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const p = (await requireProgramador())!;
  const data = await getEstimacion(params.id, p.id);
  if (!data) notFound();
  const { est, cot, tareasFinales } = data;

  // Determinamos qué versión mostrar como "principal" (la más fiel a lo
  // que el cliente / jefe acabó viendo).
  //   1. Si hay cotización con tareas → usar esas (las que Johana editó).
  //   2. Si no, usar las que limpió la IA (datos_limpios).
  //   3. Si tampoco, las originales del programador.
  const tareasPrincipales: Tarea[] | null =
    tareasFinales && tareasFinales.length > 0
      ? tareasFinales
      : est.datos_limpios?.tareas && est.datos_limpios.tareas.length > 0
      ? (est.datos_limpios.tareas as Tarea[])
      : null;

  // ¿Hay diferencia con lo original como para ofrecer el toggle?
  const tareasOriginales = (est.datos_raw?.tareas ?? []) as Tarea[];
  const hayDiferenciaConOriginal =
    !!tareasPrincipales && tareasPrincipales !== tareasOriginales;

  const estadoEfectivo = cot?.estado ?? est.estado;
  const horasFinales =
    cot?.horas_envio ?? est.datos_raw?.envio?.horas ?? null;
  const buffer = est.datos_raw?.buffer_porcentaje ?? 0;
  const clickupUrl = cot?.clickup_ticket_id
    ? `https://app.clickup.com/t/${cot.clickup_ticket_id}`
    : null;

  const totOrig = totales(est.datos_raw?.tareas);

  const nombreOriginal = est.datos_raw?.nombre_solicitud || "(sin nombre)";
  const nombreLimpio = est.datos_limpios?.nombre_solicitud || nombreOriginal;

  return (
    <>
      <Link
        href="/programador/estimaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-display">{nombreLimpio}</h1>
          <span
            className={`badge ${badgeEstado(estadoEfectivo)}`}
          >
            {labelEstado(estadoEfectivo)}
          </span>
        </div>
        <p className="text-caption text-text-secondary">
          {est.datos_raw?.proyecto_nombre && (
            <>
              <span className="text-text-primary">
                {est.datos_raw.proyecto_nombre}
              </span>
              {" · "}
            </>
          )}
          creada {formatFechaLarga(est.created_at)}
          {cot?.jefe_aprobacion_recibida_at && (
            <>
              {" · "}aprobada {formatFechaLarga(cot.jefe_aprobacion_recibida_at)}
            </>
          )}
        </p>
      </header>

      {/* Resumen de horas */}
      <section className="card space-y-5">
        <h2 className="text-heading-2">Resumen de horas</h2>

        <div>
          <div className="text-overline text-text-tertiary mb-3">
            Tus horas originales
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-caption text-text-tertiary">Mínimo</div>
              <div
                className="mt-1 num-tabular"
                style={{ fontSize: 22, fontWeight: 600 }}
              >
                {totOrig.min}h
              </div>
            </div>
            <div>
              <div className="text-caption text-text-tertiary">PERT</div>
              <div
                className="mt-1 num-tabular"
                style={{ fontSize: 22, fontWeight: 600 }}
              >
                {totOrig.pert}h
              </div>
            </div>
            <div>
              <div className="text-caption text-text-tertiary">Máximo</div>
              <div
                className="mt-1 num-tabular"
                style={{ fontSize: 22, fontWeight: 600 }}
              >
                {totOrig.max}h
              </div>
            </div>
          </div>
        </div>

        {buffer > 0 && (
          <p className="text-caption text-text-secondary">
            Buffer aplicado por Johana: <strong>+{buffer}%</strong>
          </p>
        )}

        {horasFinales != null && horasFinales > 0 && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="text-overline text-text-tertiary flex items-center gap-1">
              <Send size={12} strokeWidth={1.5} />
              Horas enviadas al jefe / cliente
            </div>
            <div
              className="mt-1 num-tabular"
              style={{ fontSize: 28, fontWeight: 700 }}
            >
              {horasFinales}h
            </div>
            <div className="text-caption text-text-tertiary">
              Total final con buffer y ajustes que decidió Johana.
            </div>
          </div>
        )}
      </section>

      {/* Ticket JIRA */}
      {clickupUrl && (
        <a
          href={clickupUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          <ExternalLink size={16} strokeWidth={1.75} />
          <span>Abrir ticket de ClickUp</span>
        </a>
      )}

      {/* Tareas — con toggle entre final (enviado) y original */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-heading-2">
            Tareas (
            {tareasPrincipales
              ? tareasPrincipales.length
              : tareasOriginales.length}
            )
          </h2>
          {tareasPrincipales && hayDiferenciaConOriginal && (
            <ToggleOriginalLimpia
              limpia={tareasPrincipales}
              original={tareasOriginales}
              nombreOriginal={nombreOriginal}
              nombreLimpio={nombreLimpio}
              labelLimpia={tareasFinales ? "Final (enviadas)" : "Limpia (IA)"}
            />
          )}
        </div>

        {tareasFinales && tareasFinales.length > 0 && (
          <p className="text-caption text-text-secondary">
            Estas son las tareas <strong>finales</strong> que Johana envió al
            jefe — pueden ser distintas a las que escribiste si ella las editó
            o eliminó conceptos.
          </p>
        )}

        {/* Si NO hay diferencias entre versiones, renderizamos directo
            sin toggle (más limpio). */}
        {(!tareasPrincipales || !hayDiferenciaConOriginal) && (
          <ul className="space-y-3">
            {(tareasPrincipales ?? tareasOriginales).map((t, i) => (
              <li
                key={i}
                className="rounded-[12px] border overflow-hidden"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div
                  className="flex items-center justify-between px-5 py-3 border-b"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div className="text-overline text-text-tertiary">
                    Tarea {i + 1}
                  </div>
                  <span className="text-caption text-text-tertiary num-tabular">
                    {t.hrs_min}–{t.hrs_max}h
                  </span>
                </div>
                <div className="p-5 space-y-2">
                  <div className="text-body-medium">{t.nombre}</div>
                  {t.descripcion && (
                    <p className="text-body text-text-secondary whitespace-pre-wrap">
                      {t.descripcion}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notas */}
      {est.datos_raw?.notas && (
        <section className="card space-y-2">
          <h2 className="text-heading-2">Tus notas</h2>
          <p className="text-body text-text-secondary whitespace-pre-wrap">
            {est.datos_raw.notas}
          </p>
        </section>
      )}
    </>
  );
}
