import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import Markdown from "@/components/ui/Markdown";
import AnalisisFinanciero from "@/components/forms/AnalisisFinanciero";
import CotizacionEditor, {
  CotizacionAcciones,
  CotizacionLog,
  type CotizacionData,
} from "@/components/forms/CotizacionEditor";
import HorasEnvioCotizacion from "@/components/forms/HorasEnvioCotizacion";
import InlineTextEditor from "@/components/forms/InlineTextEditor";
import MontoFijoEditor from "@/components/forms/MontoFijoEditor";
import SlackMessageEditor from "@/components/forms/SlackMessageEditor";
import ConceptosCotizacionCard from "@/components/forms/ConceptosCotizacionCard";
import ProyectoEditor from "@/components/forms/ProyectoEditor";
import { getProyectoOptions } from "@/lib/clickup/client";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildSlackText } from "@/lib/slack/format";
import { formatFechaLarga as fmtFecha } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Tarea = {
  id: string;
  orden: number;
  nombre_limpio: string | null;
  nombre_original: string;
  descripcion_limpia: string | null;
  hrs_min: number;
  hrs_max: number;
};

type Cotizacion = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  horas_envio: number | null;
  precio_venta_hora: number | null;
  slack_text: string | null;
  created_at: string;
  clickup_ticket_id: string | null;
  ia_recomendacion: string | null;
  borrador_correo: string | null;
  contexto_sherlyn: string | null;
  jefe_aprobacion_solicitada_at: string | null;
  jefe_aprobacion_recibida_at: string | null;
  tipo_precio: string | null;
  monto_fijo: number | null;
  proyecto_clickup_id: string | null;
  proyecto_nombre: string | null;
  programadores: { nombre: string; precio_hora: number } | null;
  tareas_estimacion: Tarea[];
};

type Accion = {
  id: string;
  tipo_accion: string;
  metadata: Record<string, any> | null;
  created_at: string;
};

type Concepto = {
  id: string;
  orden: number;
  concepto: string;
  cantidad: number;
  precio_unitario: number;
};

async function getCotizacion(
  id: string
): Promise<{
  cotizacion: Cotizacion;
  acciones: Accion[];
  conceptos: Concepto[];
} | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();

  // Intento con todos los campos nuevos (migraciones 0004 + 0005).
  // Si alguna columna no existe, reintento con menos campos.
  const selectFull = `id, nombre, estado, horas_min, horas_max, horas_envio, precio_venta_hora, slack_text, created_at, clickup_ticket_id,
     ia_recomendacion, borrador_correo, contexto_sherlyn,
     jefe_aprobacion_solicitada_at, jefe_aprobacion_recibida_at,
     tipo_precio, monto_fijo, proyecto_clickup_id, proyecto_nombre, estimacion_formulario_id,
     programadores(nombre, precio_hora),
     tareas_estimacion(id, orden, nombre_limpio, nombre_original, descripcion_limpia, hrs_min, hrs_max)`;
  const selectNoProyectoNombre = selectFull.replace(", proyecto_nombre", "");
  const selectNoFijo = selectNoProyectoNombre.replace("tipo_precio, monto_fijo, proyecto_clickup_id,\n     ", "");
  const selectNo0005 = selectNoFijo.replace("precio_venta_hora, slack_text, ", "");
  const selectNoExtras = selectNo0005.replace("horas_envio, ", "");

  let cotResp = await supa.from("cotizaciones").select(selectFull).eq("id", id).maybeSingle();
  if (cotResp.error && /proyecto_nombre/i.test(cotResp.error.message)) {
    cotResp = await supa.from("cotizaciones").select(selectNoProyectoNombre).eq("id", id).maybeSingle();
  }
  if (cotResp.error && /(tipo_precio|monto_fijo)/i.test(cotResp.error.message)) {
    cotResp = await supa.from("cotizaciones").select(selectNoFijo).eq("id", id).maybeSingle();
  }
  if (cotResp.error && /(precio_venta_hora|slack_text)/.test(cotResp.error.message)) {
    cotResp = await supa
      .from("cotizaciones")
      .select(selectNo0005)
      .eq("id", id)
      .maybeSingle();
  }
  if (cotResp.error && /horas_envio/.test(cotResp.error.message)) {
    cotResp = await supa
      .from("cotizaciones")
      .select(selectNoExtras)
      .eq("id", id)
      .maybeSingle();
  }

  const { data: log } = await supa
    .from("acciones_cotizacion")
    .select("id, tipo_accion, metadata, created_at")
    .eq("cotizacion_id", id)
    .order("created_at", { ascending: false });

  if (cotResp.error || !cotResp.data) return null;
  const data = cotResp.data as any;
  data.tareas_estimacion?.sort((a: Tarea, b: Tarea) => a.orden - b.orden);

  // Backfill: si la cotización no tiene proyecto_nombre pero viene de una
  // estimación, leerlo del datos_raw de la estimación (cotizaciones viejas).
  if (!data.proyecto_nombre && data.estimacion_formulario_id) {
    const { data: est } = await supa
      .from("estimaciones_formulario")
      .select("datos_raw")
      .eq("id", data.estimacion_formulario_id)
      .maybeSingle();
    const p = (est as any)?.datos_raw?.proyecto_nombre;
    if (p) data.proyecto_nombre = p;
  }

  // Conceptos de la cotización fija (si la tabla existe)
  let conceptos: Concepto[] = [];
  try {
    const { data: c } = await supa
      .from("conceptos_cotizacion")
      .select("id, orden, concepto, cantidad, precio_unitario")
      .eq("cotizacion_id", id)
      .order("orden", { ascending: true });
    if (c) conceptos = c as Concepto[];
  } catch {}

  return {
    cotizacion: data as Cotizacion,
    acciones: (log as unknown as Accion[]) ?? [],
    conceptos,
  };
}


import { labelEstado, badgeEstado } from "@/lib/estados";

export default async function CotizacionDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const [result, proyectosRaw] = await Promise.all([
    getCotizacion(params.id),
    getProyectoOptions().catch(() => []),
  ]);
  if (!result) notFound();
  const { cotizacion: it, acciones, conceptos } = result;
  const proyectos = proyectosRaw.map((p) => ({ id: p.id, nombre: p.name }));

  const precio = it.programadores?.precio_hora ?? 0;
  const costoMin = it.horas_min * precio;
  const costoMax = it.horas_max * precio;
  const horasEnvio = it.horas_envio ?? Math.round(((it.horas_min + it.horas_max) / 2) * 10) / 10;

  const editorData: CotizacionData = {
    id: it.id,
    nombre: it.nombre,
    estado: it.estado,
    horas_min: it.horas_min,
    horas_max: it.horas_max,
    clickup_ticket_id: it.clickup_ticket_id,
    ia_recomendacion: it.ia_recomendacion,
    contexto_sherlyn: it.contexto_sherlyn,
    borrador_correo: it.borrador_correo,
    tareas: it.tareas_estimacion.map((t) => ({
      id: t.id,
      orden: t.orden,
      nombre_limpio: t.nombre_limpio ?? t.nombre_original,
      descripcion_limpia: t.descripcion_limpia,
      hrs_min: t.hrs_min,
      hrs_max: t.hrs_max,
    })),
  };

  return (
    <>
      <Link
        href="/panel/cotizaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Volver
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-display">{it.nombre}</h1>
          <span className={`badge ${badgeEstado(it.estado)}`}>
            {labelEstado(it.estado)}
          </span>
        </div>
        <p className="text-caption text-text-secondary">
          {it.programadores?.nombre ?? "—"}
          {it.proyecto_nombre && (
            <> · <span className="text-text-primary">{it.proyecto_nombre}</span></>
          )}
          {" · creada "}{fmtFecha(it.created_at)}
          {it.jefe_aprobacion_recibida_at && (
            <> · aprobada {fmtFecha(it.jefe_aprobacion_recibida_at)}</>
          )}
        </p>
      </header>

      {it.clickup_ticket_id ? (
        <a
          href={`https://app.clickup.com/t/${it.clickup_ticket_id}`}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          <ExternalLink size={16} strokeWidth={1.75} />
          <span>Ver ticket en ClickUp</span>
        </a>
      ) : (
        <div
          className="card card-tight text-caption"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--state-warning)",
            color: "var(--text-secondary)",
          }}
        >
          ⚠️ Esta cotización aún no tiene ticket en ClickUp. Usa el botón “Reintentar
          ClickUp” en Acciones.
        </div>
      )}

      <CotizacionAcciones
        cotizacionId={it.id}
        estado={it.estado}
        tieneTicketClickUp={!!it.clickup_ticket_id}
      />

      {/* 1. Resumen — varía según tipo (horas vs monto fijo) */}
      {it.tipo_precio === "fijo" ? (
        <section className="card space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-heading-2">Resumen</h2>
            <span className="badge badge-info">Monto fijo</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="text-overline text-text-tertiary">Monto total</div>
              <div className="mt-1 text-heading-1 num-tabular">
                {(it.monto_fijo ?? 0).toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                MXN
              </div>
              <div className="text-caption text-text-tertiary">
                Cotización extraordinaria, no se factura por horas.
              </div>
            </div>
            <div>
              <div className="text-overline text-text-tertiary">Atendido por</div>
              <div className="mt-1 text-heading-1">
                {it.programadores?.nombre ?? "—"}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="card space-y-4">
          <h2 className="text-heading-2">Resumen</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-overline text-text-tertiary">Horas enviadas</div>
              <div className="mt-1 text-heading-1 num-tabular">{horasEnvio}h</div>
              <div className="text-caption text-text-tertiary">
                rango: {it.horas_min}–{it.horas_max}h
              </div>
            </div>
            <div>
              <div className="text-overline text-text-tertiary">Precio interno / hr</div>
              <div className="mt-1 text-heading-1 num-tabular">
                ${precio.toLocaleString("es-MX")}
              </div>
            </div>
            <div>
              <div className="text-overline text-text-tertiary">Costo (horas enviadas)</div>
              <div className="mt-1 text-heading-1 num-tabular">
                ${(horasEnvio * precio).toLocaleString("es-MX")}
              </div>
              <div className="text-caption text-text-tertiary">
                {horasEnvio}h × ${precio.toLocaleString("es-MX")}/h
              </div>
            </div>
            <div>
              <div className="text-overline text-text-tertiary">Costo rango</div>
              <div className="mt-1 text-heading-1 num-tabular">
                ${costoMin.toLocaleString("es-MX")}–${costoMax.toLocaleString("es-MX")}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Recomendación IA */}
      {it.ia_recomendacion && (
        <section
          className="card"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="text-overline text-text-tertiary mb-2">Recomendación IA</div>
          <Markdown text={it.ia_recomendacion} className="text-body text-text-primary" />
        </section>
      )}

      {/* Proyecto — editable, siempre visible */}
      <ProyectoEditor
        cotizacionId={it.id}
        proyectos={proyectos}
        proyectoIdInicial={it.proyecto_clickup_id ?? null}
        proyectoNombreInicial={it.proyecto_nombre ?? null}
      />

      {/* 3. Análisis financiero — solo para tipo horas */}
      {it.tipo_precio !== "fijo" && (
        <AnalisisFinanciero
          savePath={`/api/cotizaciones/${it.id}/precio-venta`}
          precioHoraInterno={precio}
          precioVentaInicial={it.precio_venta_hora ?? null}
          horasMin={it.horas_min}
          horasMax={it.horas_max}
        />
      )}

      {/* Editor de la cotización (nombre + tareas) — para tipo horas */}
      {it.tipo_precio !== "fijo" && <CotizacionEditor cotizacion={editorData} />}

      {/* 4. Horas a enviar — solo para tipo horas */}
      {it.tipo_precio !== "fijo" && (
        <HorasEnvioCotizacion
          cotizacionId={it.id}
          horasMin={it.horas_min}
          horasMax={it.horas_max}
          horasEnvioActual={it.horas_envio ?? null}
        />
      )}

      {/* Conceptos / monto — solo para cotizaciones fijas */}
      {it.tipo_precio === "fijo" &&
        (conceptos.length > 0 ? (
          <ConceptosCotizacionCard
            cotizacionId={it.id}
            conceptosIniciales={conceptos}
            montoTotal={it.monto_fijo ?? 0}
          />
        ) : (
          <MontoFijoEditor
            cotizacionId={it.id}
            montoActual={it.monto_fijo ?? null}
          />
        ))}

      {/* 5. Contexto Sherlyn */}
      <InlineTextEditor
        cotizacionId={it.id}
        field="contexto_sherlyn"
        label="Contexto para Sherlyn"
        initialValue={it.contexto_sherlyn}
        rows={4}
        placeholder="1-2 párrafos explicando el alcance a Sherlyn para que mande al cliente."
        iaTipo="sherlyn"
        iaContexto={
          it.tipo_precio === "fijo"
            ? `Cotización: ${it.nombre} · Monto: $${(it.monto_fijo ?? 0).toLocaleString("es-MX")} MXN`
            : `Cotización: ${it.nombre} · Horas: ${it.horas_min}–${it.horas_max}h · Programador: ${it.programadores?.nombre ?? "—"}`
        }
      />

      {/* 6. Borrador correo */}
      <InlineTextEditor
        cotizacionId={it.id}
        field="borrador_correo"
        label="Borrador de correo al cliente"
        initialValue={it.borrador_correo}
        rows={8}
        placeholder="Cuerpo del correo que Sherlyn mandará al cliente."
        iaTipo="correo"
        iaContexto={
          it.tipo_precio === "fijo"
            ? `Cotización: ${it.nombre} · Monto total: $${(it.monto_fijo ?? 0).toLocaleString("es-MX")} MXN`
            : `Cotización: ${it.nombre} · Horas: ${it.horas_min}–${it.horas_max}h`
        }
      />

      {/* 7. Mensaje al jefe (Slack) — editable + IA */}
      <SlackMessageEditor
        cotizacionId={it.id}
        slackText={
          it.slack_text ??
          buildSlackText({
            nombreCotizacion: it.nombre,
            proyecto: null,
            programador: it.programadores?.nombre ?? "—",
            horasEnvio: horasEnvio,
            bufferPct: 0,
            descripcionCorta:
              it.contexto_sherlyn?.split(/[.\n]/)[0] ?? it.nombre,
            puntosClave: it.tareas_estimacion
              .slice(0, 4)
              .map((t) => t.nombre_limpio || t.nombre_original),
            notas: null,
            clickupUrl: it.clickup_ticket_id
              ? `https://app.clickup.com/t/${it.clickup_ticket_id}`
              : null,
          })
        }
        iaContexto={
          it.tipo_precio === "fijo"
            ? `Cotización: ${it.nombre} · Monto: $${(it.monto_fijo ?? 0).toLocaleString("es-MX")} MXN · Atendido por: ${it.programadores?.nombre ?? "—"}`
            : `Cotización: ${it.nombre} · Horas enviadas: ${horasEnvio}h · Programador: ${it.programadores?.nombre ?? "—"}`
        }
      />

      {/* 8 / 9. Historial */}
      <CotizacionLog acciones={acciones} />
    </>
  );
}
