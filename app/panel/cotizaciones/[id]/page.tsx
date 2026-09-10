import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import InlineHeading from "@/components/ui/InlineHeading";
import MarcarRevisada from "@/components/ui/MarcarRevisada";
import EstimacionForm, {
  type ExistenteAccion,
  type ExistenteCotizacion,
} from "@/app/estimaciones/nueva/EstimacionForm";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildSlackText } from "@/lib/slack/format";
import { formatFechaLarga as fmtFecha } from "@/lib/dates";
import { labelEstado, badgeEstado } from "@/lib/estados";

export const dynamic = "force-dynamic";

const BUCKET_PDFS = "cotizacion-pdfs";

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
  ia_recomendacion: string | null;
  borrador_correo: string | null;
  contexto_sherlyn: string | null;
  jefe_aprobacion_solicitada_at: string | null;
  jefe_aprobacion_recibida_at: string | null;
  tipo_precio: string | null;
  monto_fijo: number | null;
  proyecto_clickup_id: string | null;
  proyecto_nombre: string | null;
  buffer_porcentaje: number | null;
  envio_pdf_path: string | null;
  envio_pdf_nombre_original: string | null;
  envio_pdf_titulo: string | null;
  envio_horas_totales: number | null;
  envio_costo_aproximado: number | null;
  envio_estimado_por: string | null;
  envio_fecha: string | null;
  canal_entrada: string | null;
  prioridad: string | null;
  programador_id: string | null;
  notas_programador: string | null;
  programadores: { nombre: string; precio_hora: number } | null;
  tareas_estimacion: Tarea[];
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
  acciones: ExistenteAccion[];
  conceptos: Concepto[];
  pdfUrl: string | null;
} | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();

  // Intento con todos los campos nuevos (migraciones 0004 + 0005 + 0016 + 0019).
  // Si alguna columna no existe, reintento con menos campos.
  const selectFull = `id, nombre, estado, horas_min, horas_max, horas_envio, precio_venta_hora, slack_text, created_at,
     canal_entrada, prioridad, programador_id, notas_programador,
     ia_recomendacion, borrador_correo, contexto_sherlyn,
     jefe_aprobacion_solicitada_at, jefe_aprobacion_recibida_at,
     tipo_precio, monto_fijo, proyecto_clickup_id, proyecto_nombre, estimacion_formulario_id,
     buffer_porcentaje, envio_pdf_path, envio_pdf_nombre_original, envio_pdf_titulo, envio_horas_totales,
     envio_costo_aproximado, envio_estimado_por, envio_fecha,
     programadores(nombre, precio_hora),
     tareas_estimacion(id, orden, nombre_limpio, nombre_original, descripcion_limpia, hrs_min, hrs_max)`;
  const selectNo0019 = selectFull.replace(", envio_pdf_titulo", "");
  const selectNo0016 = selectNo0019.replace(
    /buffer_porcentaje, envio_pdf_path, envio_pdf_nombre_original, envio_horas_totales,\s*\n\s*envio_costo_aproximado, envio_estimado_por, envio_fecha,\n\s*/,
    ""
  );
  const selectNoProyectoNombre = selectNo0016.replace(", proyecto_nombre", "");
  const selectNoFijo = selectNoProyectoNombre.replace("tipo_precio, monto_fijo, proyecto_clickup_id,\n     ", "");
  const selectNo0005 = selectNoFijo.replace("precio_venta_hora, slack_text, ", "");
  const selectNoExtras = selectNo0005.replace("horas_envio, ", "");

  let cotResp = await supa.from("cotizaciones").select(selectFull).eq("id", id).maybeSingle();
  if (cotResp.error && /envio_pdf_titulo/i.test(cotResp.error.message)) {
    cotResp = await supa.from("cotizaciones").select(selectNo0019).eq("id", id).maybeSingle();
  }
  if (cotResp.error && /(buffer_porcentaje|envio_pdf_path|envio_horas_totales)/i.test(cotResp.error.message)) {
    cotResp = await supa.from("cotizaciones").select(selectNo0016).eq("id", id).maybeSingle();
  }
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

  // Vista previa del PDF de envío — signed URL de 1h (el bucket es privado).
  let pdfUrl: string | null = null;
  if (data.envio_pdf_path) {
    try {
      const { data: signed } = await supa.storage
        .from(BUCKET_PDFS)
        .createSignedUrl(data.envio_pdf_path, 3600);
      pdfUrl = signed?.signedUrl ?? null;
    } catch {}
  }

  return {
    cotizacion: data as Cotizacion,
    acciones: (log as unknown as ExistenteAccion[]) ?? [],
    conceptos,
    pdfUrl,
  };
}

async function getProgramadores(): Promise<
  { id: string; nombre: string; precio_hora: number }[]
> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const supa = createSupabaseServiceClient();
    const { data, error } = await supa
      .from("programadores")
      .select("id, nombre, precio_hora")
      .eq("activo", true)
      .order("nombre");
    if (error) return [];
    return (data ?? []).map((p) => ({ ...p, precio_hora: p.precio_hora ?? 0 }));
  } catch {
    return [];
  }
}

// Proyectos activos del catálogo (no ClickUp) — trae también el precio/hora
// de venta configurado en el proyecto, para el cálculo de "Costo estimado".
async function getProyectosCatalogo(): Promise<
  { id: string; nombre: string; precio_hora_venta: number; moneda_hora: "MXN" | "USD" }[]
> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const supa = createSupabaseServiceClient();
    const { data, error } = await supa
      .from("proyectos")
      .select("id, nombre, precio_hora_venta, moneda_hora")
      .eq("activo", true)
      .order("nombre");
    if (error) return [];
    return (data ?? []) as any[];
  } catch {
    return [];
  }
}

export default async function CotizacionDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const [result, proyectos, programadores] = await Promise.all([
    getCotizacion(params.id),
    getProyectosCatalogo(),
    getProgramadores(),
  ]);
  if (!result) notFound();
  const { cotizacion: it, acciones, conceptos, pdfUrl } = result;

  const precio = it.programadores?.precio_hora ?? 0;
  const horasEnvio = it.horas_envio ?? Math.round(((it.horas_min + it.horas_max) / 2) * 10) / 10;
  const esFijo = it.tipo_precio === "fijo";

  // El mensaje de Slack por default (si Johana no lo editó a mano) — mismo
  // cálculo que hacía la página antes de unificar, ahora resuelto en el
  // server component para no tener que exportar buildSlackText al cliente.
  const puntosClaveSlack = it.tareas_estimacion
    .slice(0, 4)
    .map((t) => t.nombre_limpio || t.nombre_original);
  const slackTextFallback = buildSlackText({
    nombreCotizacion: it.nombre,
    proyecto: null,
    programador: it.programadores?.nombre ?? "—",
    horasEnvio,
    bufferPct: 0,
    descripcionCorta: it.contexto_sherlyn?.split(/[.\n]/)[0] ?? it.nombre,
    puntosClave: puntosClaveSlack,
    notas: null,
    clickupUrl: null,
  });

  const existente: ExistenteCotizacion = {
    id: it.id,
    estado: it.estado,
    tipoPrecio: esFijo ? "fijo" : "horas",
    nombre: it.nombre,
    programadorId: it.programador_id,
    programadorNombre: it.programadores?.nombre ?? null,
    precioHoraInterno: precio,
    proyectoId: it.proyecto_clickup_id,
    proyectoNombre: it.proyecto_nombre,
    prioridad: (it.prioridad as "alta" | "media" | "baja" | null) ?? null,
    notasProgramador: it.notas_programador,
    bufferPorcentaje: it.buffer_porcentaje ?? 0,
    horasMin: it.horas_min,
    horasMax: it.horas_max,
    horasEnvio: it.horas_envio ?? null,
    tareas: it.tareas_estimacion.map((t) => ({
      id: t.id,
      orden: t.orden,
      nombre_limpio: t.nombre_limpio ?? t.nombre_original,
      descripcion_limpia: t.descripcion_limpia,
      hrs_min: t.hrs_min,
      hrs_max: t.hrs_max,
    })),
    iaRecomendacion: it.ia_recomendacion,
    borradorCorreo: it.borrador_correo,
    precioVentaHora: it.precio_venta_hora,
    montoFijo: it.monto_fijo,
    conceptos,
    envioPdfPath: it.envio_pdf_path,
    envioPdfNombreOriginal: it.envio_pdf_nombre_original,
    envioPdfTitulo: it.envio_pdf_titulo ?? null,
    envioHorasTotales: it.envio_horas_totales,
    envioCostoAproximado: it.envio_costo_aproximado,
    envioEstimadoPor: it.envio_estimado_por,
    envioFecha: it.envio_fecha,
    pdfUrl,
    slackText: it.slack_text ?? slackTextFallback,
    acciones,
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

      <header className="card space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-1.5">
            <InlineHeading cotizacionId={it.id} initialValue={it.nombre} />
            <p className="text-caption text-text-secondary">
              {it.programadores?.nombre ?? "—"}
              {it.proyecto_nombre && (
                <> · <span className="text-text-primary">{it.proyecto_nombre}</span></>
              )}
              {" · creada "}{fmtFecha(it.created_at)}
              {" · por "}
              {it.canal_entrada === "formulario"
                ? it.programadores?.nombre ?? "programador"
                : "Johana"}
              {it.jefe_aprobacion_recibida_at && (
                <> · visto bueno de Iván {fmtFecha(it.jefe_aprobacion_recibida_at)}</>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`badge-lg ${badgeEstado(it.estado)}`}>
              <span className="badge-dot" />
              {labelEstado(it.estado)}
            </span>
            {it.prioridad && (
              <span className={`badge-outline badge-outline-${it.prioridad}`}>
                <span className="badge-dot" />
                Prioridad {it.prioridad}
              </span>
            )}
          </div>
        </div>
      </header>

      <MarcarRevisada cotizacionId={it.id} />

      <EstimacionForm
        programadores={programadores}
        proyectos={proyectos}
        modoAdmin
        existente={existente}
      />
    </>
  );
}
