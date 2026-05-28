import Link from "next/link";
import {
  ClipboardList,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireProgramador } from "@/lib/programador/auth";
import DonutChart from "@/components/ui/DonutChart";
import BarChart from "@/components/ui/BarChart";
import { formatFechaCorta } from "@/lib/dates";

export const dynamic = "force-dynamic";

type EstFila = {
  id: string;
  created_at: string;
  estado: string;
  cotizacion_ref: string | null;
  datos_raw: { nombre_solicitud?: string };
};

type CotLite = {
  id: string;
  estado: string;
  estimacion_formulario_id: string | null;
  horas_envio: number | null;
};

async function getDashboardData(programadorId: string) {
  const supa = createSupabaseServiceClient();

  const { data: ests } = await supa
    .from("estimaciones_formulario")
    .select("id, created_at, estado, cotizacion_ref, datos_raw")
    .eq("programador_id", programadorId)
    .order("created_at", { ascending: false })
    .limit(500);
  const estimaciones = (ests ?? []) as EstFila[];

  const cotIds = estimaciones
    .map((e) => e.cotizacion_ref)
    .filter((x): x is string => !!x);
  const cotByEst = new Map<string, CotLite>();
  if (cotIds.length > 0) {
    const sel = "id, estado, estimacion_formulario_id, horas_envio";
    const selSin = sel.replace(", horas_envio", "");
    let resp: { data: any; error: any } = await supa
      .from("cotizaciones")
      .select(sel)
      .in("id", cotIds);
    if (resp.error && /horas_envio/i.test(resp.error.message)) {
      resp = await supa.from("cotizaciones").select(selSin).in("id", cotIds);
    }
    for (const c of (resp.data ?? []) as any[]) {
      if (c.estimacion_formulario_id) {
        cotByEst.set(c.estimacion_formulario_id, c as CotLite);
      }
    }
  }

  type Bucket =
    | "recibida"
    | "procesada"
    | "esperando"
    | "aprobada"
    | "en_desarrollo"
    | "enviada"
    | "cambios"
    | "descartada";
  const buckets: Record<Bucket, number> = {
    recibida: 0,
    procesada: 0,
    esperando: 0,
    aprobada: 0,
    en_desarrollo: 0,
    enviada: 0,
    cambios: 0,
    descartada: 0,
  };

  let totalHorasEnviadas = 0;

  for (const e of estimaciones) {
    const cot = cotByEst.get(e.id);
    const ef = cot?.estado ?? e.estado;
    if (ef === "recibida") buckets.recibida++;
    else if (ef === "procesada_ia" || ef === "en_revision") buckets.procesada++;
    else if (ef === "esperando_aprobacion" || ef === "pendiente_revisar")
      buckets.esperando++;
    else if (ef === "aprobada") buckets.aprobada++;
    else if (ef === "en_desarrollo") buckets.en_desarrollo++;
    else if (ef === "enviada_cliente") buckets.enviada++;
    else if (ef === "cambios_solicitados") buckets.cambios++;
    else if (ef === "descartada" || ef === "archivada") buckets.descartada++;
    if (cot?.horas_envio) totalHorasEnviadas += Number(cot.horas_envio);
  }

  const total = estimaciones.length;
  const aprobadasYAdelante =
    buckets.aprobada + buckets.en_desarrollo + buckets.enviada;
  const tasaAprobacion =
    total > 0 ? Math.round((aprobadasYAdelante / total) * 100) : 0;

  // ── Serie de últimos 6 meses (incluye el actual) ──────────────────
  const MESES_LABEL = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  const hoy = new Date();
  const serie: { label: string; value: number; year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    serie.push({
      label: MESES_LABEL[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth(),
      value: 0,
    });
  }
  for (const e of estimaciones) {
    const d = new Date(e.created_at);
    const slot = serie.find(
      (s) => s.year === d.getFullYear() && s.month === d.getMonth()
    );
    if (slot) slot.value++;
  }

  // Comparativa: mes actual vs mes anterior (para chip de tendencia)
  const mesActual = serie[serie.length - 1].value;
  const mesAnterior = serie[serie.length - 2].value;
  const variacionMes =
    mesAnterior > 0
      ? Math.round(((mesActual - mesAnterior) / mesAnterior) * 100)
      : mesActual > 0
      ? 100
      : 0;

  const recientes = estimaciones.slice(0, 5).map((e) => {
    const cot = cotByEst.get(e.id);
    return {
      id: e.id,
      nombre: e.datos_raw?.nombre_solicitud ?? "(sin nombre)",
      created_at: e.created_at,
      estado_efectivo: cot?.estado ?? e.estado,
    };
  });

  return {
    total,
    buckets,
    tasaAprobacion,
    totalHorasEnviadas,
    serie,
    mesActual,
    variacionMes,
    recientes,
  };
}

import { labelEstado, badgeEstado } from "@/lib/estados";

// Paleta monocromática con pops de color SOLO donde aporta significado:
//   verde = todo bien (aprobada, en desarrollo, enviada al cliente)
//   rojo  = problema (cambios solicitados)
//   grises = todo lo demás, en escala de claridad por etapa
const COLOR = {
  recibida: "#D1D5DB",      // gray-300 (recién llega, claro)
  procesada: "#9CA3AF",     // gray-400
  esperando: "#6B7280",     // gray-500
  aprobada: "#22C55E",      // green (win)
  en_desarrollo: "#16A34A", // green-600
  enviada: "#15803D",       // green-700
  cambios: "#EF4444",       // red (problema)
  descartada: "#4B5563",    // gray-600 (apagada, sin color)
};

export default async function DashboardProgramadorPage() {
  const p = (await requireProgramador())!;
  const d = await getDashboardData(p.id);

  const segmentos = [
    { label: "Recibidas", value: d.buckets.recibida, color: COLOR.recibida },
    { label: "Procesadas con IA", value: d.buckets.procesada, color: COLOR.procesada },
    { label: "Esperando jefe", value: d.buckets.esperando, color: COLOR.esperando },
    { label: "Aprobadas", value: d.buckets.aprobada, color: COLOR.aprobada },
    { label: "En desarrollo", value: d.buckets.en_desarrollo, color: COLOR.en_desarrollo },
    { label: "Enviadas al cliente", value: d.buckets.enviada, color: COLOR.enviada },
    { label: "Cambios solicitados", value: d.buckets.cambios, color: COLOR.cambios },
    { label: "Descartadas / Archivadas", value: d.buckets.descartada, color: COLOR.descartada },
  ].filter((s) => s.value > 0);

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-display">Hola, {p.nombre.split(" ")[0]}</h1>
        <p className="text-body text-text-secondary">
          Resumen de tus estimaciones.
        </p>
      </header>

      {/* Fila de 4 KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total enviadas"
          valor={d.total}
          subtexto="acumulado"
          icon={ClipboardList}
        />
        <KpiCard
          label="Aprobadas"
          valor={d.buckets.aprobada + d.buckets.en_desarrollo + d.buckets.enviada}
          subtexto={`${d.tasaAprobacion}% del total`}
          icon={CheckCircle2}
          color="var(--state-success)"
        />
        <KpiCard
          label="Este mes"
          valor={d.mesActual}
          subtexto={
            d.variacionMes !== 0
              ? `${d.variacionMes > 0 ? "+" : ""}${d.variacionMes}% vs mes anterior`
              : "sin cambio vs mes anterior"
          }
          icon={d.variacionMes >= 0 ? ArrowUpRight : ArrowDownRight}
          color={
            d.variacionMes >= 0
              ? "var(--state-success)"
              : "var(--state-error)"
          }
        />
        <KpiCard
          label="Horas cotizadas"
          valor={`${Math.round(d.totalHorasEnviadas)}h`}
          subtexto="Total enviado al cliente"
          icon={Clock}
        />
      </section>

      {/* Fila visual: bar chart (2/3) + donut (1/3) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Estimaciones por mes */}
        <div className="card lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-heading-2">Estimaciones por mes</h2>
              <p className="text-caption text-text-tertiary">Últimos 6 meses</p>
            </div>
            {d.variacionMes !== 0 && (
              <span
                className="text-caption num-tabular inline-flex items-center gap-1"
                style={{
                  color:
                    d.variacionMes >= 0
                      ? "var(--state-success)"
                      : "var(--state-error)",
                }}
              >
                {d.variacionMes >= 0 ? (
                  <TrendingUp size={12} strokeWidth={1.75} />
                ) : (
                  <ArrowDownRight size={12} strokeWidth={1.75} />
                )}
                {d.variacionMes > 0 ? "+" : ""}
                {d.variacionMes}% este mes
              </span>
            )}
          </div>
          <BarChart data={d.serie.map((s) => ({ label: s.label, value: s.value }))} />
        </div>

        {/* Donut estado distribution */}
        <div className="card space-y-3">
          <div>
            <h2 className="text-heading-2">Estado actual</h2>
            <p className="text-caption text-text-tertiary">
              Distribución por etapa
            </p>
          </div>
          {d.total === 0 ? (
            <div className="text-body text-text-secondary text-center py-6">
              Sin datos aún.
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <DonutChart
                  data={segmentos}
                  centerLabel="Total"
                  centerValue={d.total}
                  size={160}
                  thickness={22}
                />
              </div>
              <ul className="space-y-2">
                {segmentos.map((s) => {
                  const pct = Math.round((s.value / d.total) * 100);
                  return (
                    <li
                      key={s.label}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: s.color,
                            flexShrink: 0,
                          }}
                        />
                        <span className="text-caption truncate">
                          {s.label}
                        </span>
                      </div>
                      <span className="text-caption num-tabular text-text-secondary whitespace-nowrap">
                        {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Actividad reciente */}
      {d.recientes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-2">Actividad reciente</h2>
            <Link
              href="/programador/estimaciones"
              className="text-caption text-text-secondary hover:text-text-primary"
            >
              Ver todas →
            </Link>
          </div>
          <ul className="space-y-2">
            {d.recientes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/programador/estimaciones/${r.id}`}
                  className="card card-tight flex items-center justify-between gap-3 hover:border-border-strong transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-body-medium truncate">{r.nombre}</div>
                    <div className="text-caption text-text-tertiary">
                      {formatFechaCorta(r.created_at)}
                    </div>
                  </div>
                  <span className={`badge ${badgeEstado(r.estado_efectivo)}`}>
                    {labelEstado(r.estado_efectivo)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Acciones rápidas */}
      <section className="space-y-4">
        <h2 className="text-heading-2">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/programador/estimaciones/nueva" className="btn-primary">
            <Plus size={16} strokeWidth={1.5} />
            <span>Nueva estimación</span>
          </Link>
          <Link href="/programador/estimaciones" className="btn-secondary">
            <ClipboardList size={16} strokeWidth={1.5} />
            <span>Ver mis estimaciones</span>
          </Link>
        </div>
      </section>
    </>
  );
}

function KpiCard({
  label,
  valor,
  subtexto,
  icon: Icon,
  color = "var(--text-primary)",
}: {
  label: string;
  valor: string | number;
  subtexto?: string;
  icon: typeof CheckCircle2;
  color?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-overline text-text-tertiary">{label}</div>
          <div
            className="mt-2 num-tabular"
            style={{ fontSize: 32, fontWeight: 600, lineHeight: 1, color }}
          >
            {valor}
          </div>
          {subtexto && (
            <div className="text-caption text-text-tertiary mt-2">
              {subtexto}
            </div>
          )}
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--bg-surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} strokeWidth={1.75} style={{ color }} />
        </div>
      </div>
    </div>
  );
}
