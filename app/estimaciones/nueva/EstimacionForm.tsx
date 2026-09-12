"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  Save,
  FileText,
  ListChecks,
  Calculator,
  DollarSign,
  Clock,
  CheckCheck,
  Folder,
  RefreshCcw,
  PencilLine,
  MessageSquare,
  History,
} from "lucide-react";
import TareasTabla, { TareaRow, filaVacia } from "@/components/forms/TareasTabla";
import TareasEnviadas from "@/components/forms/TareasEnviadas";
import ProyectoSearch from "@/components/forms/ProyectoSearch";
import BufferSelector from "@/components/forms/BufferSelector";
import TotalesFlotantes from "@/components/forms/TotalesFlotantes";
import ResumenEstimacion from "@/components/forms/ResumenEstimacion";
import EnviarPdfModal from "@/components/forms/EnviarPdfModal";
import Modal from "@/components/ui/Modal";
import Markdown from "@/components/ui/Markdown";
import { totalesPERT, aplicarBuffer, distribuirHorasProporcional } from "@/lib/pert";
import {
  CotizacionAcciones,
  ComunicacionAcciones,
  CotizacionLog,
} from "@/components/forms/CotizacionEditor";
import EnvioDetalle from "@/components/forms/EnvioDetalle";
import InlineTextEditor from "@/components/forms/InlineTextEditor";
import SlackMessageEditor from "@/components/forms/SlackMessageEditor";
import AnalisisFinanciero from "@/components/forms/AnalisisFinanciero";
import ConceptosCotizacionCard from "@/components/forms/ConceptosCotizacionCard";
import MontoFijoEditor from "@/components/forms/MontoFijoEditor";
import type { Concepto } from "@/components/forms/ConceptosEditor";

type Programador = { id: string; nombre: string; precio_hora?: number };
type Proyecto = {
  id: string;
  nombre: string;
  precio_hora_venta?: number;
  moneda_hora?: "MXN" | "USD";
  emoji?: string;
};

// Nombre + emoji, como se guarda en el snapshot de texto libre
// `cotizaciones.proyecto_nombre` (y se muestra tal cual en listas/tarjetas).
function nombreProyectoConEmoji(p: Proyecto | null | undefined): string | null {
  if (!p) return null;
  return p.emoji ? `${p.nombre} ${p.emoji}` : p.nombre;
}
type Prioridad = "alta" | "media" | "baja";
type HorasEnvioTipo = "min" | "pert" | "max" | "custom";

// ─── Shape de una cotización existente, para el modo edición ─────────────

export type ExistenteTarea = {
  id?: string;
  orden: number;
  nombre_limpio: string;
  descripcion_limpia: string | null;
  hrs_min: number;
  hrs_max: number;
  // Horas que se acomodaron proporcionalmente al guardar "Horas a enviar"
  // (ver POST /api/cotizaciones/[id]/horas-envio). null = nunca se ha
  // guardado "Horas a enviar" para esta cotización.
  hrsEnviadas: number | null;
};

export type ExistenteAccion = {
  id: string;
  tipo_accion: string;
  metadata: Record<string, any> | null;
  created_at: string;
};

export type ExistenteCotizacion = {
  id: string;
  estado: string;
  tipoPrecio: "horas" | "fijo";
  nombre: string;
  programadorId: string | null;
  programadorNombre: string | null;
  precioHoraInterno: number;
  proyectoId: string | null;
  proyectoNombre: string | null;
  prioridad: "alta" | "media" | "baja" | null;
  notasProgramador: string | null;
  bufferPorcentaje: number;
  horasMin: number;
  horasMax: number;
  horasEnvio: number | null;
  tareas: ExistenteTarea[];
  iaRecomendacion: string | null;
  borradorCorreo: string | null;
  precioVentaHora: number | null;
  montoFijo: number | null;
  conceptos: Concepto[];
  envioPdfPath: string | null;
  envioPdfNombreOriginal: string | null;
  envioPdfTitulo: string | null;
  envioHorasTotales: number | null;
  envioCostoAproximado: number | null;
  envioEstimadoPor: string | null;
  envioFecha: string | null;
  pdfUrl: string | null;
  slackText: string;
  acciones: ExistenteAccion[];
};

const PRIORIDADES: { value: Prioridad; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

// Azul = baja, amarillo = media, rojo = alta — mismo esquema en todo el sistema
// (badges de prioridad en el detalle, aquí en la creación/edición temprana).
const PRIORIDAD_COLOR: Record<Prioridad, { bg: string; fg: string }> = {
  baja: { bg: "#DBEAFE", fg: "#1D4ED8" },
  media: { bg: "#FEF3C7", fg: "#B45309" },
  alta: { bg: "#FEE2E2", fg: "#DC2626" },
};

function SectionTitle({
  icon: Icon,
  bg,
  fg,
  children,
}: {
  icon: React.ElementType;
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid place-items-center flex-shrink-0"
        style={{ width: 27, height: 27, borderRadius: "50%", background: bg, color: fg }}
      >
        <Icon size={13.5} strokeWidth={1.9} />
      </span>
      <h2 className="text-heading-2">{children}</h2>
    </div>
  );
}

function fmtMoneda(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda || "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toLocaleString("es-MX")} ${moneda}`;
  }
}

function tareasAFilas(tareas: ExistenteTarea[]): TareaRow[] {
  return tareas.map((t) => ({
    nombre: t.nombre_limpio,
    descripcion: t.descripcion_limpia ?? "",
    hrs_min: String(t.hrs_min ?? ""),
    hrs_max: String(t.hrs_max ?? ""),
  }));
}

function inferirTipoHorasEnvio(
  horasMin: number,
  horasMax: number,
  horasEnvio: number | null
): HorasEnvioTipo {
  if (horasEnvio == null) return "pert";
  const pert = Math.round(((horasMin + horasMax) / 2) * 10) / 10;
  if (horasEnvio === horasMin) return "min";
  if (horasEnvio === horasMax) return "max";
  if (Math.abs(horasEnvio - pert) < 0.05) return "pert";
  return "custom";
}

type Msg = { tipo: "ok" | "warn" | "err"; texto: string } | null;

function MsgLine({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p
      className="text-caption"
      style={{
        color:
          msg.tipo === "ok"
            ? "var(--state-success)"
            : msg.tipo === "warn"
            ? "var(--state-warning)"
            : "var(--state-error)",
      }}
    >
      {msg.tipo === "ok" ? "✓" : "⚠"} {msg.texto}
    </p>
  );
}

type Props = {
  programadores: Programador[];
  proyectos?: Proyecto[];
  // Modo admin (Johana crea desde /panel/cotizaciones): agrega prioridad,
  // costo estimado (con el precio/hora del proyecto), horas a enviar, y
  // guarda directo sin notificar a nadie — sin la pantalla de "enviada"
  // pensada para el programador.
  modoAdmin?: boolean;
  // Cuando se manda, el formulario entra en modo EDICIÓN sobre una
  // cotización real ya existente (cualquiera de los 12 estados, horas o
  // fijo) en vez de modo creación. Cada sección guarda de forma
  // independiente contra su endpoint correspondiente.
  existente?: ExistenteCotizacion;
};

export default function EstimacionForm({
  programadores,
  proyectos = [],
  modoAdmin = false,
  existente,
}: Props) {
  const router = useRouter();
  const esFijo = existente?.tipoPrecio === "fijo";

  // Si la lista trae un solo programador (caso portal interno donde solo
  // está el logueado), pre-seleccionarlo para evitar paso innecesario.
  const [programadorId, setProgramadorId] = useState(() =>
    existente
      ? existente.programadorId ?? ""
      : programadores.length === 1
      ? programadores[0].id
      : ""
  );
  const [proyectoId, setProyectoId] = useState(() => existente?.proyectoId ?? "");
  const [nombre, setNombre] = useState(() => existente?.nombre ?? "");
  const [notas, setNotas] = useState(() => existente?.notasProgramador ?? "");
  const [rows, setRows] = useState<TareaRow[]>(() =>
    existente
      ? existente.tareas.length > 0
        ? tareasAFilas(existente.tareas)
        : [filaVacia()]
      : [filaVacia()]
  );
  const [bufferPct, setBufferPct] = useState(() => existente?.bufferPorcentaje ?? 0);
  // Si ya existe un acomodo de "horas enviadas" por tarea, por default se
  // muestra esa vista de solo lectura en vez de la tabla editable.
  const [verEstimacionOriginal, setVerEstimacionOriginal] = useState(false);
  const [prioridad, setPrioridad] = useState<Prioridad>(
    () => (existente?.prioridad as Prioridad) ?? "media"
  );
  const [horasEnvioTipo, setHorasEnvioTipo] = useState<HorasEnvioTipo>(() =>
    existente
      ? inferirTipoHorasEnvio(existente.horasMin, existente.horasMax, existente.horasEnvio)
      : "pert"
  );
  const [horasEnvioCustom, setHorasEnvioCustom] = useState<string>(() =>
    existente &&
    inferirTipoHorasEnvio(existente.horasMin, existente.horasMax, existente.horasEnvio) ===
      "custom" &&
    existente.horasEnvio != null
      ? String(existente.horasEnvio)
      : ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [confirmAbierto, setConfirmAbierto] = useState(false);

  const [validando, setValidando] = useState(false);
  const [opinionIA, setOpinionIA] = useState<string | null>(null);
  const [opinionErr, setOpinionErr] = useState<string | null>(null);

  // ── Admin: tabs, y las dos rutas de creación (aprobación / enviada) ──
  type Tab = "desglose" | "documentos" | "financiero" | "comunicacion" | "historial";
  const [tab, setTab] = useState<Tab>(() =>
    existente ? (esFijo ? "financiero" : "desglose") : "desglose"
  );
  const [creando, setCreando] = useState<"aprobacion" | "enviada" | null>(null);
  const [modalAprobacionAbierto, setModalAprobacionAbierto] = useState(false);
  const [slackPreview, setSlackPreview] = useState("");
  const [modalPdfAbierto, setModalPdfAbierto] = useState(false);
  const [cotizacionCreadaId, setCotizacionCreadaId] = useState<string | null>(null);

  // ── Edición: guardado independiente por sección ──
  const [savingDatosGenerales, setSavingDatosGenerales] = useState(false);
  const [datosGeneralesMsg, setDatosGeneralesMsg] = useState<Msg>(null);
  const [comentarioDesglose, setComentarioDesglose] = useState("");
  const [savingDesglose, setSavingDesglose] = useState(false);
  const [desgloseMsg, setDesgloseMsg] = useState<Msg>(null);
  const [iaRecoLocal, setIaRecoLocal] = useState<string | null>(
    existente?.iaRecomendacion ?? null
  );
  const [procesandoIA, setProcesandoIA] = useState(false);
  const [procesarIAError, setProcesarIAError] = useState<string | null>(null);
  const [savingHorasEnvio, setSavingHorasEnvio] = useState(false);
  const [horasEnvioMsg, setHorasEnvioMsg] = useState<Msg>(null);

  const totales = useMemo(
    () =>
      totalesPERT(
        rows.map((r) => ({
          hrs_min: Number(r.hrs_min) || 0,
          hrs_max: Number(r.hrs_max) || 0,
        }))
      ),
    [rows]
  );

  const totalesConBuffer = useMemo(
    () => aplicarBuffer(totales, bufferPct),
    [totales, bufferPct]
  );

  const hayHorasEnviadasGuardadas = !!existente?.tareas.some((t) => t.hrsEnviadas != null);
  // Cotizaciones viejas tienen "horas_envio" (el total que se cotizó/cobró)
  // pero nunca pasaron por "Guardar horas" en esta pantalla, así que el
  // acomodo por tarea (hrs_enviadas) nunca se guardó. En vez de esconder el
  // resumen y mostrar solo el borrador editable de siempre, calculamos ese
  // acomodo al vuelo (mismo criterio proporcional que usa el guardado real)
  // nada más para mostrarlo — no se persiste hasta que ella de verdad
  // guarde horas.
  const horasEnviadasCalculadas = useMemo(() => {
    if (hayHorasEnviadasGuardadas || !existente || existente.horasEnvio == null) return null;
    return distribuirHorasProporcional(
      existente.tareas.map((t) => ({ hrs_min: t.hrs_min, hrs_max: t.hrs_max })),
      existente.horasEnvio
    );
  }, [hayHorasEnviadasGuardadas, existente]);

  const programadorSeleccionado = programadores.find((p) => p.id === programadorId);
  const proyectoSeleccionado = proyectos.find((p) => p.id === proyectoId);
  // "Costo total estimado" = lo que cuesta internamente (horas × costo/hora
  // del ESTIMADOR, siempre en MXN). "Precio total (horas a enviar)" = lo que
  // se le cobra al cliente (horas × precio de venta del PROYECTO) — son dos
  // bases distintas, cada una con su propia tarifa.
  const precioHoraInterno = programadorSeleccionado?.precio_hora ?? 0;
  const precioHoraVenta = proyectoSeleccionado?.precio_hora_venta ?? 0;
  const monedaHora = proyectoSeleccionado?.moneda_hora ?? "MXN";

  // "Horas a enviar" — en creación se basa en el borrador de tareas (aún no
  // hay nada guardado). En edición se basa en las horas YA GUARDADAS de la
  // cotización (igual que hacía HorasEnvioCotizacion antes), para que no se
  // mueva con cambios sin guardar en la pestaña Desglose. Mín/PERT/Máx
  // incluyen el buffer VIGENTE — en edición el guardado (existente.bufferPorcentaje,
  // no el que esté sin guardar en el selector), en creación el buffer en vivo.
  const horasEnvioConBuffer = useMemo(() => {
    const base = existente
      ? {
          totalMin: existente.horasMin,
          totalMax: existente.horasMax,
          totalEsperado: Math.round(((existente.horasMin + existente.horasMax) / 2) * 10) / 10,
        }
      : totales;
    const bufferVigente = existente ? existente.bufferPorcentaje ?? 0 : bufferPct;
    return aplicarBuffer(base, bufferVigente);
  }, [existente, totales, bufferPct]);
  const horasBaseMin = horasEnvioConBuffer.totalMin;
  const horasBaseMax = horasEnvioConBuffer.totalMax;
  const horasEnvioPert = horasEnvioConBuffer.totalEsperado;
  const horasEnvioValor = useMemo(() => {
    if (horasEnvioTipo === "min") return horasBaseMin;
    if (horasEnvioTipo === "max") return horasBaseMax;
    if (horasEnvioTipo === "pert") return horasEnvioPert;
    const n = Number(horasEnvioCustom);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
  }, [horasEnvioTipo, horasEnvioCustom, horasBaseMin, horasBaseMax, horasEnvioPert]);

  // Precio total = horas que realmente se van a enviar (no el PERT+buffer)
  // por el precio de venta configurado en el proyecto.
  const precioTotalEnvio = Math.round(horasEnvioValor * precioHoraVenta * 100) / 100;
  // Costo y margen — misma base de horas que "Precio total" (horasEnvioValor),
  // para que el % de margen compare manzanas con manzanas.
  const costoTotalEnviado = Math.round(horasEnvioValor * precioHoraInterno * 100) / 100;
  const margenPct =
    precioTotalEnvio > 0
      ? Math.round(((precioTotalEnvio - costoTotalEnviado) / precioTotalEnvio) * 1000) / 10
      : null;
  const colorMargen =
    margenPct == null
      ? undefined
      : margenPct < 0
      ? "var(--state-error)"
      : margenPct < 20
      ? "var(--state-warning)"
      : "var(--state-success)";

  const tareasValidas = rows.filter((r) => r.nombre.trim() !== "");

  const cotizacionIdEfectivo = existente?.id ?? cotizacionCreadaId;

  if (ok) {
    return (
      <div className="card text-center py-12 space-y-3">
        <div style={{ fontSize: 48 }}>✓</div>
        <h2 className="text-heading-1">Estimación enviada</h2>
        <p className="text-body text-text-secondary">
          Johana recibió tu estimación. No necesitas hacer nada más.
        </p>
      </div>
    );
  }

  const buildPayload = () => {
    const proyecto = proyectos.find((p) => p.id === proyectoId);
    return {
      programador_id: programadorId,
      nombre_solicitud: nombre.trim(),
      notas: notas.trim() || undefined,
      proyecto_nombre: nombreProyectoConEmoji(proyecto),
      buffer_porcentaje: bufferPct,
      prioridad,
      tareas: tareasValidas.map((r) => ({
        nombre: r.nombre.trim(),
        descripcion: r.descripcion.trim(),
        hrs_min: Number(r.hrs_min) || 0,
        hrs_max: Number(r.hrs_max) || 0,
      })),
    };
  };

  const validarConIA = async () => {
    setOpinionErr(null);
    setOpinionIA(null);
    if (!nombre.trim() || rows.length === 0) {
      setOpinionErr("Llena al menos el nombre y una tarea con horas.");
      return;
    }
    setValidando(true);
    try {
      const res = await fetch("/api/ia/validar-horas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (!res.ok) {
        setOpinionErr(json.error || "No se pudo consultar la IA.");
        return;
      }
      setOpinionIA(json.opinion);
    } catch {
      setOpinionErr("Error de red. Intenta de nuevo.");
    } finally {
      setValidando(false);
    }
  };

  // ── Flujo programador: submit abre modal de confirmación (no envía aún) ──
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const localErrors: Record<string, string> = {};
    if (!programadorId) localErrors.programador_id = "Selecciona un estimador.";
    if (!nombre.trim()) localErrors.nombre_solicitud = "Pon un nombre.";
    if (rows.length === 0) localErrors.tareas = "Añade al menos una tarea.";
    rows.forEach((r, i) => {
      if (!r.nombre.trim())
        localErrors[`tareas.${i}.nombre`] = "Falta el nombre.";
      const min = Number(r.hrs_min);
      const max = Number(r.hrs_max);
      if (!Number.isFinite(min) || min < 0)
        localErrors[`tareas.${i}.hrs_min`] = "Inválido.";
      if (!Number.isFinite(max) || max < 0)
        localErrors[`tareas.${i}.hrs_max`] = "Inválido.";
      if (Number.isFinite(min) && Number.isFinite(max) && max < min)
        localErrors[`tareas.${i}.hrs_max`] = "Máx debe ser ≥ Mín.";
    });
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setConfirmAbierto(true);
  };

  const enviar = async () => {
    setErrors({});
    setSending(true);
    try {
      const res = await fetch("/api/estimaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {};
        (json.errors ?? []).forEach((e: any) => (map[e.path] = e.message));
        setErrors(map);
        if (!json.errors) map.__form = json.error ?? "No se pudo enviar.";
        setConfirmAbierto(false);
        return;
      }
      setConfirmAbierto(false);
      setOk(true);
    } catch {
      setErrors({ __form: "Error de red. Intenta de nuevo." });
      setConfirmAbierto(false);
    } finally {
      setSending(false);
    }
  };

  // ── Flujo admin: guarda directo, sin modal ni notificación ──
  const guardarAdmin = async (comoBorrador: boolean) => {
    setErrors({});
    const localErrors: Record<string, string> = {};
    if (!programadorId) localErrors.programador_id = "Selecciona un estimador.";
    if (!nombre.trim()) localErrors.nombre_solicitud = "Pon un nombre.";
    if (!comoBorrador) {
      if (tareasValidas.length === 0) localErrors.tareas = "Añade al menos una tarea.";
      tareasValidas.forEach((r, i) => {
        const min = Number(r.hrs_min);
        const max = Number(r.hrs_max);
        if (!Number.isFinite(min) || min < 0) localErrors[`tareas.${i}.hrs_min`] = "Inválido.";
        if (!Number.isFinite(max) || max < 0) localErrors[`tareas.${i}.hrs_max`] = "Inválido.";
        if (Number.isFinite(min) && Number.isFinite(max) && max < min)
          localErrors[`tareas.${i}.hrs_max`] = "Máx debe ser ≥ mín.";
      });
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/estimaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPayload(),
          guardar_borrador: comoBorrador,
          notificar: false,
          horas_envio_tipo: tareasValidas.length > 0 ? horasEnvioTipo : undefined,
          horas_envio_custom:
            tareasValidas.length > 0 && horasEnvioTipo === "custom"
              ? Number(horasEnvioCustom) || 0
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {};
        (json.errors ?? []).forEach((e: any) => (map[e.path] = e.message));
        if (!json.errors) map.__form = json.error ?? "No se pudo guardar.";
        setErrors(map);
        return;
      }
      router.push(`/panel/cotizaciones/${json.id}`);
    } catch {
      setErrors({ __form: "Error de red. Intenta de nuevo." });
    } finally {
      setSending(false);
    }
  };

  // ── Validación compartida por "Enviar a aprobación" y "Crear en enviada
  // al cliente" — ambas requieren datos completos y al menos una tarea. ──
  const validarParaCrear = (): boolean => {
    setErrors({});
    const localErrors: Record<string, string> = {};
    if (!programadorId) localErrors.programador_id = "Selecciona un estimador.";
    if (!nombre.trim()) localErrors.nombre_solicitud = "Pon un nombre.";
    if (tareasValidas.length === 0) localErrors.tareas = "Añade al menos una tarea.";
    tareasValidas.forEach((r, i) => {
      const min = Number(r.hrs_min);
      const max = Number(r.hrs_max);
      if (!Number.isFinite(min) || min < 0) localErrors[`tareas.${i}.hrs_min`] = "Inválido.";
      if (!Number.isFinite(max) || max < 0) localErrors[`tareas.${i}.hrs_max`] = "Inválido.";
      if (Number.isFinite(min) && Number.isFinite(max) && max < min)
        localErrors[`tareas.${i}.hrs_max`] = "Máx debe ser ≥ mín.";
    });
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return false;
    }
    return true;
  };

  // Crea el registro directo en la base (misma ruta que "Guardar como
  // borrador"/"Crear" de siempre) y devuelve su id, para que las dos rutas
  // nuevas (Slack / PDF) sigan operando sobre un id real ya existente.
  const crearCotizacionAdmin = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/estimaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPayload(),
          guardar_borrador: false,
          notificar: false,
          horas_envio_tipo: horasEnvioTipo,
          horas_envio_custom:
            horasEnvioTipo === "custom" ? Number(horasEnvioCustom) || 0 : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {};
        (json.errors ?? []).forEach((e: any) => (map[e.path] = e.message));
        if (!json.errors) map.__form = json.error ?? "No se pudo crear.";
        setErrors(map);
        return null;
      }
      return json.id as string;
    } catch {
      setErrors({ __form: "Error de red. Intenta de nuevo." });
      return null;
    }
  };

  const abrirEnviarAprobacion = () => {
    if (!validarParaCrear()) return;
    const proyectoNombre = nombreProyectoConEmoji(proyectoSeleccionado) ?? "Sin proyecto";
    const estimadorNombre = programadorSeleccionado?.nombre ?? "—";
    const lineasNotas = notas.trim() ? `\nNotas: ${notas.trim()}` : "";
    setSlackPreview(
      `📋 *${nombre.trim()}*\nProyecto: ${proyectoNombre}\nEstimador: ${estimadorNombre}\nPrioridad: ${prioridad}\nHoras a enviar: ${horasEnvioValor}h${lineasNotas}`
    );
    setModalAprobacionAbierto(true);
  };

  const confirmarEnviarAprobacion = async () => {
    setCreando("aprobacion");
    try {
      const id = await crearCotizacionAdmin();
      if (!id) {
        setModalAprobacionAbierto(false);
        return;
      }
      await fetch(`/api/cotizaciones/${id}/cambiar-estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "esperando_aprobacion" }),
      });
      const r2 = await fetch(`/api/cotizaciones/${id}/reenviar-slack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r2.ok) {
        const j2 = await r2.json();
        setErrors({
          __form:
            j2.error ||
            'Se creó, pero no se pudo enviar el mensaje a Slack. Usa "Reenviar Slack" desde el detalle.',
        });
      }
      setModalAprobacionAbierto(false);
      router.push(`/panel/cotizaciones/${id}`);
    } finally {
      setCreando(null);
    }
  };

  const abrirCrearEnviada = async () => {
    if (!validarParaCrear()) return;
    setCreando("enviada");
    try {
      const id = await crearCotizacionAdmin();
      if (!id) return;
      setCotizacionCreadaId(id);
      setTab("documentos");
      setModalPdfAbierto(true);
    } finally {
      setCreando(null);
    }
  };

  // ── Edición: Datos generales (estimador, proyecto, prioridad) ──
  const datosGeneralesDirty = !!existente && (
    programadorId !== (existente.programadorId ?? "") ||
    proyectoId !== (existente.proyectoId ?? "") ||
    prioridad !== ((existente.prioridad as Prioridad) ?? "media")
  );

  const guardarDatosGenerales = async () => {
    if (!existente) return;
    setSavingDatosGenerales(true);
    setDatosGeneralesMsg(null);
    try {
      const proyecto = proyectos.find((p) => p.id === proyectoId);
      const res = await fetch(`/api/cotizaciones/${existente.id}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programador_id: programadorId || null,
          proyecto_clickup_id: proyectoId || null,
          proyecto_nombre: nombreProyectoConEmoji(proyecto),
          prioridad,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDatosGeneralesMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      setDatosGeneralesMsg({ tipo: "ok", texto: "Guardado" });
      setTimeout(() => setDatosGeneralesMsg(null), 2500);
      router.refresh();
    } catch {
      setDatosGeneralesMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSavingDatosGenerales(false);
    }
  };

  // ── Edición: Desglose (tareas, buffer, notas) — mismo payload que usaba
  // EstimacionTempranaEditor, sin programador/proyecto/prioridad (esos ya
  // se guardan aparte en "Datos generales"). ──
  const guardarDesglose = async () => {
    if (!existente) return;
    setSavingDesglose(true);
    setDesgloseMsg(null);
    try {
      const res = await fetch(`/api/cotizaciones/${existente.id}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buffer_porcentaje: bufferPct,
          notas_programador: notas.trim() || null,
          horas_min: totales.totalMin,
          horas_max: totales.totalMax,
          tareas: rows.map((r, i) => ({
            orden: i,
            nombre_limpio: r.nombre.trim(),
            descripcion_limpia: r.descripcion.trim() || null,
            hrs_min: Number(r.hrs_min) || 0,
            hrs_max: Number(r.hrs_max) || 0,
          })),
          comentario: comentarioDesglose.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDesgloseMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      setComentarioDesglose("");
      setDesgloseMsg({ tipo: "ok", texto: "Guardado" });
      setTimeout(() => setDesgloseMsg(null), 2500);
      router.refresh();
    } catch {
      setDesgloseMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSavingDesglose(false);
    }
  };

  const procesarIA = async () => {
    if (!existente) return;
    setProcesandoIA(true);
    setProcesarIAError(null);
    try {
      const res = await fetch(`/api/cotizaciones/${existente.id}/procesar-ia`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setProcesarIAError(json.error || "Error procesando con IA");
        return;
      }
      const limpia = json.datos_limpios;
      if (limpia?.tareas) {
        setRows((prev) =>
          prev.map((r, i) =>
            limpia.tareas[i]
              ? {
                  ...r,
                  nombre: limpia.tareas[i].nombre ?? r.nombre,
                  descripcion: limpia.tareas[i].descripcion ?? r.descripcion,
                }
              : r
          )
        );
      }
      if (limpia?.recomendacion_horas) setIaRecoLocal(limpia.recomendacion_horas);
      router.refresh();
    } catch {
      setProcesarIAError("Error de red");
    } finally {
      setProcesandoIA(false);
    }
  };

  // ── Edición: Horas a enviar (sidebar) — misma lógica de
  // HorasEnvioCotizacion, pero integrada en el panel lateral. ──
  const horasEnvioDirty =
    !!existente && horasEnvioValor !== (existente.horasEnvio ?? horasEnvioPert);

  const guardarHorasEnvio = async () => {
    if (!existente) return;
    if (horasEnvioTipo === "custom" && (!Number(horasEnvioCustom) || Number(horasEnvioCustom) <= 0)) {
      setHorasEnvioMsg({ tipo: "err", texto: "Pon un número válido en personalizado." });
      return;
    }
    setSavingHorasEnvio(true);
    setHorasEnvioMsg(null);
    try {
      const res = await fetch(`/api/cotizaciones/${existente.id}/horas-envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: horasEnvioTipo,
          custom: horasEnvioTipo === "custom" ? Number(horasEnvioCustom) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setHorasEnvioMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      setHorasEnvioMsg({
        tipo: "ok",
        texto: `Horas actualizadas a ${json.horas_envio}h. Se acomodaron por tarea.`,
      });
      setTimeout(() => setHorasEnvioMsg(null), 3500);
      router.refresh();
    } catch {
      setHorasEnvioMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSavingHorasEnvio(false);
    }
  };

  const ICONO_TAB: Record<Tab, typeof ListChecks> = {
    desglose: ListChecks,
    documentos: Folder,
    financiero: DollarSign,
    comunicacion: MessageSquare,
    historial: History,
  };

  const tabsList: { value: Tab; label: string }[] = existente
    ? esFijo
      ? [
          { value: "financiero", label: "Financiero" },
          { value: "documentos", label: "Documentos" },
          { value: "comunicacion", label: "Comunicación" },
          { value: "historial", label: "Historial" },
        ]
      : [
          { value: "desglose", label: "Desglose de estimación" },
          { value: "documentos", label: "Documentos" },
          { value: "financiero", label: "Financiero" },
          { value: "comunicacion", label: "Comunicación" },
          { value: "historial", label: "Historial" },
        ]
    : [
        { value: "desglose", label: "Desglose de estimación" },
        { value: "documentos", label: "Documentos" },
      ];

  const mostrarDesglose = !existente || !esFijo;
  const hayHorasEnviadas = hayHorasEnviadasGuardadas || horasEnviadasCalculadas != null;

  return (
    <div className="space-y-4">
    {modoAdmin && !existente && (
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Crear estimación</h1>
          <p className="text-body text-text-secondary">
            No se manda ninguna notificación — tú decides cuándo avanzarla.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => guardarAdmin(true)}
            disabled={sending || creando !== null}
            className="btn-secondary"
          >
            <Save size={16} strokeWidth={1.75} />
            <span>{sending ? "Guardando…" : "Guardar como borrador"}</span>
          </button>
          <button
            type="button"
            onClick={abrirEnviarAprobacion}
            disabled={sending || creando !== null || tareasValidas.length === 0}
            className="btn-secondary"
          >
            <Send size={16} strokeWidth={1.75} />
            <span>{creando === "aprobacion" ? "Enviando…" : "Enviar a aprobación"}</span>
          </button>
          <button
            type="button"
            onClick={abrirCrearEnviada}
            disabled={sending || creando !== null || tareasValidas.length === 0}
            className="btn-primary"
          >
            <CheckCheck size={16} strokeWidth={1.75} />
            <span>{creando === "enviada" ? "Creando…" : "Crear en enviada al cliente"}</span>
          </button>
        </div>
      </header>
    )}

    {existente && (
      <CotizacionAcciones
        cotizacionId={existente.id}
        estado={existente.estado}
        horasEnvio={existente.horasEnvio ?? horasEnvioPert}
        precioHora={existente.precioHoraInterno}
      />
    )}

    {modoAdmin && !existente && errors.__form && (
      <p className="text-caption" style={{ color: "var(--state-error)" }}>
        {errors.__form}
      </p>
    )}

    <div className={modoAdmin ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start" : undefined}>
    <form onSubmit={modoAdmin ? (e) => e.preventDefault() : onSubmit} className="space-y-6 pb-32">
      {/* Bloque 1: Datos generales */}
      <section className="card space-y-5">
        <SectionTitle icon={FileText} bg="#DBEAFE" fg="#1D4ED8">
          Datos generales
        </SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!existente && (
            <div className="md:col-span-2">
              <label className="field-label">Nombre de la cotización *</label>
              <input
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Soporte pasarela de pagos Pollo Loco"
              />
              {errors.nombre_solicitud && (
                <span className="field-hint" style={{ color: "var(--state-error)" }}>
                  {errors.nombre_solicitud}
                </span>
              )}
            </div>
          )}

          <div className="md:col-span-2">
            <label className="field-label">
              Proyecto {proyectos.length === 0 && (
                <span className="text-text-tertiary font-normal">(sin proyectos activos)</span>
              )}
            </label>
            <ProyectoSearch
              proyectos={proyectos}
              value={proyectoId}
              onChange={setProyectoId}
              disabled={proyectos.length === 0}
            />
            <span className="field-hint">
              {proyectos.length > 0
                ? `${proyectos.length} proyectos activos`
                : "Créalos desde el catálogo de Proyectos"}
            </span>
          </div>

          <div>
            <label className="field-label">Estimador *</label>
            <select
              className="input"
              value={programadorId}
              onChange={(e) => setProgramadorId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {programadores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {errors.programador_id && (
              <span className="field-hint" style={{ color: "var(--state-error)" }}>
                {errors.programador_id}
              </span>
            )}
          </div>

          {modoAdmin && (
            <div>
              <label className="field-label">Prioridad</label>
              <div className="flex gap-2 h-[38px] items-center">
                {PRIORIDADES.map((p) => {
                  const activa = prioridad === p.value;
                  const c = PRIORIDAD_COLOR[p.value];
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPrioridad(p.value)}
                      className="btn-sm"
                      style={{
                        background: activa ? c.bg : "transparent",
                        color: activa ? c.fg : "var(--text-secondary)",
                        border: `1px solid ${activa ? c.bg : "var(--border-default)"}`,
                        fontWeight: activa ? 600 : 500,
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {existente && (
          <div className="flex items-center justify-end gap-3 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <MsgLine msg={datosGeneralesMsg} />
            <button
              type="button"
              onClick={guardarDatosGenerales}
              disabled={savingDatosGenerales || !datosGeneralesDirty}
              className="btn-secondary btn-sm"
            >
              <Save size={14} strokeWidth={1.75} />
              <span>
                {savingDatosGenerales
                  ? "Guardando…"
                  : datosGeneralesDirty
                  ? "Guardar datos generales"
                  : "Sin cambios"}
              </span>
            </button>
          </div>
        )}
      </section>

      {modoAdmin && (
        <div className="flex gap-1 border-b overflow-x-auto overflow-y-hidden" style={{ borderColor: "var(--border-subtle)" }}>
          {tabsList.map((t) => {
            const Icono = ICONO_TAB[t.value];
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className="px-4 py-2.5 text-body-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{
                  borderBottom: `2px solid ${tab === t.value ? "var(--accent)" : "transparent"}`,
                  color: tab === t.value ? "var(--text-primary)" : "var(--text-secondary)",
                  marginBottom: -1,
                }}
              >
                <Icono size={14} strokeWidth={1.75} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {mostrarDesglose && (
      <div hidden={modoAdmin && tab !== "desglose"} className="space-y-6">
      {hayHorasEnviadas && !verEstimacionOriginal ? (
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={Clock} bg="#FEF3C7" fg="#B45309">
            Horas enviadas
          </SectionTitle>
          <button
            type="button"
            onClick={() => setVerEstimacionOriginal(true)}
            className="btn-secondary btn-sm"
          >
            <PencilLine size={14} strokeWidth={1.75} />
            <span>Ver/editar estimación original</span>
          </button>
        </div>
        <TareasEnviadas
          tareas={existente!.tareas.map((t, i) => ({
            nombre_limpio: t.nombre_limpio,
            hrs_min: t.hrs_min,
            hrs_max: t.hrs_max,
            hrsEnviadas: hayHorasEnviadasGuardadas ? t.hrsEnviadas : horasEnviadasCalculadas?.[i] ?? null,
          }))}
        />
        {!hayHorasEnviadasGuardadas && (
          <p className="text-caption text-text-tertiary">
            Esta cotización no tiene un acomodo de horas guardado por tarea — este reparto es
            calculado proporcionalmente sobre las {existente!.horasEnvio}h enviadas en total. Usa
            &quot;Guardar horas&quot; (abajo) para dejarlo fijo.
          </p>
        )}
      </section>
      ) : (
      <>
      {/* Bloque 2: Tareas */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle icon={ListChecks} bg="#FEF3C7" fg="#B45309">
            Tareas y horas
          </SectionTitle>
          <div className="flex items-center gap-3">
            <span className="text-caption text-text-tertiary">
              El esperado se calcula automáticamente
            </span>
            {hayHorasEnviadas && (
              <button
                type="button"
                onClick={() => setVerEstimacionOriginal(false)}
                className="btn-ghost btn-sm"
              >
                <Clock size={14} strokeWidth={1.75} />
                <span>Volver a horas enviadas</span>
              </button>
            )}
          </div>
        </div>
        <TareasTabla rows={rows} onChange={setRows} errors={errors} />
        {errors.tareas && (
          <p className="text-caption text-center" style={{ color: "var(--state-error)" }}>
            {errors.tareas}
          </p>
        )}
      </section>

      {existente && (
        <section
          className="card space-y-3"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          {iaRecoLocal ? (
            <>
              <div className="text-overline text-text-tertiary">Recomendación IA</div>
              <Markdown text={iaRecoLocal} className="text-body text-text-primary" />
            </>
          ) : (
            <p className="text-body text-text-secondary">
              Claude puede limpiar el texto de las tareas y sugerir si las horas
              son adecuadas. No es obligatorio para avanzar.
            </p>
          )}
          {procesarIAError && (
            <p className="text-caption" style={{ color: "var(--state-error)" }}>
              {procesarIAError}
            </p>
          )}
          <button
            type="button"
            onClick={procesarIA}
            disabled={procesandoIA || rows.every((r) => !r.nombre.trim())}
            className={iaRecoLocal ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
          >
            {iaRecoLocal ? (
              <RefreshCcw size={14} strokeWidth={1.75} />
            ) : (
              <Sparkles size={14} strokeWidth={1.75} />
            )}
            <span>
              {procesandoIA ? "Procesando…" : iaRecoLocal ? "Reprocesar con IA" : "Formatear con IA"}
            </span>
          </button>
        </section>
      )}

      {/* Bloque 3: Totales + Buffer */}
      <section className="card space-y-6">
        <SectionTitle icon={Calculator} bg="#DCFCE7" fg="#15803D">
          Resumen
        </SectionTitle>

        <div>
          <div className="text-overline text-text-tertiary mb-3">Horas originales</div>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-caption text-text-tertiary">Mínimo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalMin}h
              </div>
            </div>
            <div
              className="text-center border-l border-r"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="text-caption text-text-tertiary">PERT esperado</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalEsperado}h
              </div>
            </div>
            <div className="text-center">
              <div className="text-caption text-text-tertiary">Máximo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalMax}h
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-overline text-text-tertiary pt-4">Buffer adicional</div>
          <p className="text-caption text-text-secondary">
            Margen extra que se suma a tu estimación, para cubrir imprevistos.
          </p>
          <BufferSelector value={bufferPct} onChange={setBufferPct} />
        </div>

        {bufferPct > 0 && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="text-overline text-text-tertiary mb-3">
              Total con buffer (+{bufferPct}%)
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-caption text-text-tertiary">Mínimo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalMin}h
                </div>
              </div>
              <div
                className="text-center border-l border-r"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="text-caption text-text-tertiary">PERT esperado</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalEsperado}h
                </div>
              </div>
              <div className="text-center">
                <div className="text-caption text-text-tertiary">Máximo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalMax}h
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-caption text-text-tertiary text-center">
          PERT esperado = (mín + máx) / 2 — punto medio del rango.
        </p>
      </section>

      {/* Bloque 4: Notas — solo aquí para el programador; en modo admin vive
          en el panel lateral, debajo del costo estimado. */}
      {!modoAdmin && (
        <section className="card">
          <label className="field-label">Notas generales</label>
          <span className="field-hint mb-2">Opcional — supuestos o advertencias globales</span>
          <textarea
            className="textarea min-h-[100px] mt-2"
            rows={4}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </section>
      )}

      {/* Bloque 5: Validación IA */}
      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <SectionTitle icon={Sparkles} bg="#EDE9FE" fg="#6D28D9">
              ¿Las horas tienen sentido?
            </SectionTitle>
            <p className="text-caption text-text-secondary mt-1">
              Pide a la IA una segunda opinión antes de enviar. No envía la estimación.
            </p>
          </div>
          <button
            type="button"
            onClick={validarConIA}
            disabled={validando}
            className="btn-secondary"
          >
            <Sparkles size={16} strokeWidth={1.75} />
            <span>{validando ? "Consultando…" : "Validar con IA"}</span>
          </button>
        </div>
        {opinionErr && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {opinionErr}
          </p>
        )}
        {opinionIA && (
          <div
            className="rounded-[10px] p-4 text-body"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            <Markdown text={opinionIA} />
          </div>
        )}
      </section>

      {existente && (
        <section className="card space-y-3" style={{ background: "var(--bg-surface)" }}>
          <label className="field-label">Comentario sobre estos cambios (opcional)</label>
          <input
            className="input"
            value={comentarioDesglose}
            onChange={(e) => setComentarioDesglose(e.target.value)}
            placeholder="Ej. Cliente pidió ajustar pruebas y agregar capacitación"
          />
          <p className="field-hint">Queda registrado en el historial de la cotización.</p>
          <div className="flex items-center justify-end gap-3">
            <MsgLine msg={desgloseMsg} />
            <button
              type="button"
              onClick={guardarDesglose}
              disabled={savingDesglose}
              className="btn-primary"
            >
              <Save size={16} strokeWidth={1.75} />
              <span>{savingDesglose ? "Guardando…" : "Guardar cambios"}</span>
            </button>
          </div>
        </section>
      )}
      </>
      )}
      </div>
      )}

      {modoAdmin && (
        <div hidden={tab !== "documentos"} className="space-y-6">
          <section className="card space-y-4">
            <SectionTitle icon={Folder} bg="#DBEAFE" fg="#1D4ED8">
              Documentos
            </SectionTitle>
            <p className="text-caption text-text-secondary">
              Sube el PDF que se le mandó al cliente. Al subirlo, la cotización
              pasa a <strong className="text-text-primary">Enviada al cliente</strong>.
            </p>
            {existente?.envioPdfPath ? (
              <EnvioDetalle
                pdfUrl={existente.pdfUrl}
                pdfNombreOriginal={existente.envioPdfNombreOriginal}
                pdfTitulo={existente.envioPdfTitulo}
                horasTotales={existente.envioHorasTotales}
                costoAproximado={existente.envioCostoAproximado}
                estimadoPor={existente.envioEstimadoPor}
                fecha={existente.envioFecha}
              />
            ) : cotizacionIdEfectivo ? (
              <button
                type="button"
                onClick={() => setModalPdfAbierto(true)}
                className="btn-primary"
              >
                <FileText size={16} strokeWidth={1.75} />
                <span>Subir PDF de la cotización</span>
              </button>
            ) : (
              <p className="text-caption text-text-tertiary">
                Primero crea o guarda esta cotización — luego podrás subir el PDF
                aquí o desde la ficha de la cotización.
              </p>
            )}
          </section>
        </div>
      )}

      {existente && (
        <div hidden={tab !== "financiero"} className="space-y-6">
          {esFijo ? (
            existente.conceptos.length > 0 ? (
              <ConceptosCotizacionCard
                cotizacionId={existente.id}
                conceptosIniciales={existente.conceptos}
                montoTotal={existente.montoFijo ?? 0}
              />
            ) : (
              <MontoFijoEditor cotizacionId={existente.id} montoActual={existente.montoFijo} />
            )
          ) : (
            <AnalisisFinanciero
              savePath={`/api/cotizaciones/${existente.id}/precio-venta`}
              precioHoraInterno={existente.precioHoraInterno}
              precioVentaInicial={existente.precioVentaHora}
              horasMin={existente.horasMin}
              horasMax={existente.horasMax}
            />
          )}
        </div>
      )}

      {existente && (
        <div hidden={tab !== "comunicacion"} className="space-y-6">
          <ComunicacionAcciones cotizacionId={existente.id} />
          <InlineTextEditor
            cotizacionId={existente.id}
            field="borrador_correo"
            label="Borrador de correo al cliente"
            initialValue={existente.borradorCorreo}
            rows={8}
            placeholder="Cuerpo del correo que Sherlyn mandará al cliente."
            iaTipo="correo"
            iaContexto={
              esFijo
                ? `Cotización: ${existente.nombre} · Monto total: $${(existente.montoFijo ?? 0).toLocaleString("es-MX")} MXN`
                : `Cotización: ${existente.nombre} · Horas: ${existente.horasMin}–${existente.horasMax}h`
            }
          />
          <SlackMessageEditor
            cotizacionId={existente.id}
            slackText={existente.slackText}
            iaContexto={
              esFijo
                ? `Cotización: ${existente.nombre} · Monto: $${(existente.montoFijo ?? 0).toLocaleString("es-MX")} MXN · Atendido por: ${existente.programadorNombre ?? "—"}`
                : `Cotización: ${existente.nombre} · Horas enviadas: ${existente.horasEnvio ?? horasEnvioPert}h · Programador: ${existente.programadorNombre ?? "—"}`
            }
          />
        </div>
      )}

      {existente && (
        <div hidden={tab !== "historial"} className="space-y-6">
          <CotizacionLog acciones={existente.acciones} />
        </div>
      )}

      {/* Submit — solo flujo del programador; el admin usa los botones del panel lateral */}
      {!modoAdmin && (
        <div>
          {errors.__form && (
            <p
              className="text-caption text-center mb-3"
              style={{ color: "var(--state-error)" }}
            >
              {errors.__form}
            </p>
          )}
          <button type="submit" disabled={sending} className="btn-primary w-full">
            <Send size={16} strokeWidth={1.75} />
            <span>Revisar y enviar</span>
          </button>
          <p className="text-caption text-text-tertiary text-center mt-3">
            Te mostraremos un resumen antes de enviar. Una vez enviada no podrás editarla.
          </p>
        </div>
      )}

      {!modoAdmin && (
        <Modal
          open={confirmAbierto}
          onClose={() => !sending && setConfirmAbierto(false)}
          title="Confirmar envío"
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmAbierto(false)}
                disabled={sending}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={sending}
                className="btn-primary"
              >
                <Send size={16} strokeWidth={1.75} />
                <span>{sending ? "Enviando…" : "Confirmar y enviar"}</span>
              </button>
            </>
          }
        >
          <ResumenEstimacion
            programador={
              programadores.find((p) => p.id === programadorId)?.nombre ?? "—"
            }
            proyecto={proyectos.find((p) => p.id === proyectoId)?.nombre}
            nombreSolicitud={nombre.trim()}
            notas={notas.trim() || undefined}
            tareas={rows.map((r) => ({
              nombre: r.nombre.trim(),
              descripcion: r.descripcion.trim(),
              hrs_min: Number(r.hrs_min) || 0,
              hrs_max: Number(r.hrs_max) || 0,
            }))}
            bufferPct={bufferPct}
            totales={totales}
            totalesConBuffer={totalesConBuffer}
          />
          {errors.__form && (
            <p
              className="text-caption mt-4 text-center"
              style={{ color: "var(--state-error)" }}
            >
              {errors.__form}
            </p>
          )}
        </Modal>
      )}

      {!modoAdmin && (
        <TotalesFlotantes
          numTareas={rows.length}
          totalMin={totales.totalMin}
          totalEsperado={totales.totalEsperado}
          totalMax={totales.totalMax}
          bufferPct={bufferPct}
          totalMinBuf={totalesConBuffer.totalMin}
          totalEsperadoBuf={totalesConBuffer.totalEsperado}
          totalMaxBuf={totalesConBuffer.totalMax}
        />
      )}
    </form>

    {modoAdmin && (!existente || !esFijo) && (
      <aside className="lg:sticky lg:top-6 space-y-4">
        <div className="card space-y-4">
          <SectionTitle icon={DollarSign} bg="#EDE9FE" fg="#6D28D9">
            Costo estimado
          </SectionTitle>
          <div>
            <div className="text-overline text-text-tertiary">Precio total que se envió</div>
            <div className="mt-1 num-tabular" style={{ fontSize: 27, fontWeight: 700 }}>
              {fmtMoneda(precioTotalEnvio, monedaHora)}
            </div>
          </div>
          <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="text-overline text-text-tertiary">Horas enviadas</div>
            <div className="mt-1 num-tabular" style={{ fontSize: 20, fontWeight: 600 }}>
              {horasEnvioValor}h
            </div>
          </div>
          <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="text-overline text-text-tertiary">Costo</div>
            <div className="mt-1 num-tabular" style={{ fontSize: 20, fontWeight: 600 }}>
              {fmtMoneda(costoTotalEnviado, "MXN")}
            </div>
          </div>
          <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="text-overline text-text-tertiary">% de margen del proyecto</div>
            <div
              className="mt-1 num-tabular"
              style={{ fontSize: 20, fontWeight: 600, color: colorMargen }}
            >
              {margenPct != null ? `${margenPct}%` : "—"}
            </div>
            {margenPct != null && (
              <div
                className="mt-2 rounded-full overflow-hidden"
                style={{ height: 8, background: "var(--bg-overlay)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, margenPct))}%`,
                    background: colorMargen,
                    transition: "width 200ms ease",
                  }}
                />
              </div>
            )}
          </div>

          {/* Notas — debajo del costo estimado, como se pidió. En edición se
              guarda junto con el resto de "Desglose de estimación". */}
          <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <label className="field-label">Notas</label>
            <textarea
              className="textarea"
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional — supuestos o advertencias"
            />
            {existente && (
              <span className="field-hint">
                Se guarda con “Guardar cambios” en la pestaña Desglose.
              </span>
            )}
          </div>
        </div>

        {/* Horas a enviar — se elige desde la creación, o se ajusta y
            guarda de inmediato en edición. */}
        <div className="card space-y-3">
          <SectionTitle icon={Clock} bg="#DBEAFE" fg="#1D4ED8">
            Horas a enviar
          </SectionTitle>
          <p className="text-caption text-text-secondary">
            El número que verá el jefe/cliente más adelante. No cambia las horas de las tareas.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["min", "pert", "max"] as HorasEnvioTipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHorasEnvioTipo(t)}
                className={`btn-sm whitespace-nowrap ${horasEnvioTipo === t ? "btn-primary" : "btn-secondary"}`}
              >
                {t === "min"
                  ? `Mín · ${horasBaseMin}h`
                  : t === "pert"
                  ? `PERT · ${horasEnvioPert}h`
                  : `Máx · ${horasBaseMax}h`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setHorasEnvioTipo("custom")}
              className={`btn-sm whitespace-nowrap ${horasEnvioTipo === "custom" ? "btn-primary" : "btn-secondary"}`}
            >
              Personalizado
            </button>
          </div>
          {horasEnvioTipo === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                className="input input-sm num-tabular text-center w-24"
                value={horasEnvioCustom}
                onChange={(e) => setHorasEnvioCustom(e.target.value)}
                placeholder="hrs"
              />
              <span className="text-caption text-text-secondary">horas</span>
            </div>
          )}
          <div className="text-caption text-text-secondary num-tabular">
            Quedará en <strong className="text-text-primary font-semibold">{horasEnvioValor}h</strong>.
          </div>
          {existente && (
            <div className="flex items-center justify-end gap-3">
              <MsgLine msg={horasEnvioMsg} />
              <button
                type="button"
                onClick={guardarHorasEnvio}
                disabled={savingHorasEnvio || !horasEnvioDirty}
                className="btn-primary btn-sm"
              >
                <Save size={14} strokeWidth={1.75} />
                <span>{savingHorasEnvio ? "Guardando…" : "Guardar horas"}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    )}

    {existente && esFijo && (
      <aside className="lg:sticky lg:top-6 space-y-4">
        <section className="card space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-heading-2">Resumen</h2>
            <span className="badge badge-info">Monto fijo</span>
          </div>
          <div>
            <div className="text-overline text-text-tertiary">Monto total</div>
            <div className="mt-1 text-heading-1 num-tabular">
              {(existente.montoFijo ?? 0).toLocaleString("es-MX", {
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
          <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="text-overline text-text-tertiary">Atendido por</div>
            <div className="mt-1 text-heading-1">
              {programadorSeleccionado?.nombre ?? existente.programadorNombre ?? "—"}
            </div>
          </div>
        </section>
      </aside>
    )}
    </div>

    {modoAdmin && !existente && (
      <Modal
        open={modalAprobacionAbierto}
        onClose={() => !creando && setModalAprobacionAbierto(false)}
        title="Enviar a aprobación"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalAprobacionAbierto(false)}
              disabled={creando !== null}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarEnviarAprobacion}
              disabled={creando !== null}
              className="btn-primary"
            >
              <Send size={16} strokeWidth={1.75} />
              <span>{creando === "aprobacion" ? "Enviando…" : "Confirmar y enviar"}</span>
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-body text-text-secondary">
            Este mensaje se enviará a Iván por Slack para pedir su aprobación:
          </p>
          <div
            className="rounded-[10px] p-4 text-body whitespace-pre-wrap"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {slackPreview}
          </div>
          {errors.__form && (
            <p className="text-caption" style={{ color: "var(--state-error)" }}>
              {errors.__form}
            </p>
          )}
        </div>
      </Modal>
    )}

    {modoAdmin && (
      <EnviarPdfModal
        cotizacionId={cotizacionIdEfectivo ?? ""}
        open={modalPdfAbierto}
        onClose={() => setModalPdfAbierto(false)}
        onEnviado={() => {
          setModalPdfAbierto(false);
          if (existente) {
            router.refresh();
          } else if (cotizacionCreadaId) {
            router.push(`/panel/cotizaciones/${cotizacionCreadaId}`);
          }
        }}
        horasEnvio={existente ? existente.horasEnvio ?? horasEnvioPert : horasEnvioValor}
        precioHora={
          existente ? existente.precioHoraInterno : programadorSeleccionado?.precio_hora ?? 0
        }
      />
    )}
    </div>
  );
}
