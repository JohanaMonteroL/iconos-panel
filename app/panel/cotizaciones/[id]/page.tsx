import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import Markdown from "@/components/ui/Markdown";
import SlackText from "@/components/ui/SlackText";
import AnalisisFinanciero from "@/components/forms/AnalisisFinanciero";
import CotizacionEditor, {
  CotizacionAcciones,
  CotizacionLog,
  type CotizacionData,
} from "@/components/forms/CotizacionEditor";
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
  programadores: { nombre: string; precio_hora: number } | null;
  tareas_estimacion: Tarea[];
};

type Accion = {
  id: string;
  tipo_accion: string;
  metadata: Record<string, any> | null;
  created_at: string;
};

async function getCotizacion(
  id: string
): Promise<{ cotizacion: Cotizacion; acciones: Accion[] } | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();

  // Intento con todos los campos nuevos (migraciones 0004 + 0005).
  // Si alguna columna no existe, reintento con menos campos.
  const selectFull = `id, nombre, estado, horas_min, horas_max, horas_envio, precio_venta_hora, slack_text, created_at, clickup_ticket_id,
     ia_recomendacion, borrador_correo, contexto_sherlyn,
     jefe_aprobacion_solicitada_at, jefe_aprobacion_recibida_at,
     programadores(nombre, precio_hora),
     tareas_estimacion(id, orden, nombre_limpio, nombre_original, descripcion_limpia, hrs_min, hrs_max)`;
  const selectNo0005 = selectFull.replace("precio_venta_hora, slack_text, ", "");
  const selectNoExtras = selectNo0005.replace("horas_envio, ", "");

  let cotResp = await supa.from("cotizaciones").select(selectFull).eq("id", id).maybeSingle();
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
  return {
    cotizacion: data as Cotizacion,
    acciones: (log as unknown as Accion[]) ?? [],
  };
}


const estadoLabel: Record<string, string> = {
  pendiente_revisar: "Por revisar",
  esperando_aprobacion: "Esperando jefe",
  aprobada: "Aprobada",
  cambios_solicitados: "Pidieron cambios",
  en_desarrollo: "En desarrollo",
  enviada_cliente: "Enviada al cliente",
  archivada: "Archivada",
};

const estadoBadge: Record<string, string> = {
  pendiente_revisar: "badge-warning",
  esperando_aprobacion: "badge-info",
  aprobada: "badge-success",
  cambios_solicitados: "badge-danger",
  en_desarrollo: "badge-info",
  enviada_cliente: "badge-success",
  archivada: "badge-neutral",
};

export default async function CotizacionDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const result = await getCotizacion(params.id);
  if (!result) notFound();
  const { cotizacion: it, acciones } = result;

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
          <span className={`badge ${estadoBadge[it.estado] ?? "badge-neutral"}`}>
            {estadoLabel[it.estado] ?? it.estado}
          </span>
        </div>
        <p className="text-caption text-text-secondary">
          {it.programadores?.nombre ?? "—"} · creada {fmtFecha(it.created_at)}
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
            <div className="text-overline text-text-tertiary">Costo interno</div>
            <div className="mt-1 text-heading-1 num-tabular">
              ${costoMin.toLocaleString("es-MX")}–${costoMax.toLocaleString("es-MX")}
            </div>
          </div>
        </div>
      </section>

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

      {/* Análisis financiero — para ver ganancia con el precio de venta */}
      <AnalisisFinanciero
        savePath={`/api/cotizaciones/${it.id}/precio-venta`}
        precioHoraInterno={precio}
        precioVentaInicial={it.precio_venta_hora ?? null}
        horasMin={it.horas_min}
        horasMax={it.horas_max}
      />

      {/* Mensaje al jefe — usa el slack_text guardado al crear la cotización */}
      <section
        className="rounded-[12px] border overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div
          className="px-5 py-3 border-b"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h2 className="text-heading-2">Mensaje al jefe</h2>
        </div>
        <div className="p-5 space-y-2">
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              fontFamily: "Lato, ui-sans-serif, system-ui, sans-serif",
              lineHeight: 1.5,
            }}
          >
            <SlackText
              text={
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
            />
          </div>
          <p className="text-caption text-text-tertiary">
            {it.slack_text
              ? "Este es el texto que se guardó al enviar a aprobación."
              : it.clickup_ticket_id
              ? "Texto generado al momento; falta migración 0005 para fijarlo."
              : "Sin ticket aún en ClickUp — usa “Reintentar ClickUp”."}
          </p>
        </div>
      </section>

      <CotizacionEditor cotizacion={editorData} />

      <CotizacionLog acciones={acciones} />
    </>
  );
}
