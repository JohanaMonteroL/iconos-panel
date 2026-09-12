"use client";

// Tabs de la ficha de proyecto: Detalle (lo que ya existía) + 3 vistas
// nuevas derivadas del historial de cotizaciones/cobros de este proyecto.
// Los filtros de las pestañas "Cotizaciones" y "Cobros" son locales
// (estado de React, sin querystring) — son solo para explorar la lista que
// ya se cargó del servidor, no afectan a los KPIs de arriba.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { FileText, Wallet, Activity, LayoutList, Clock, Repeat, ListChecks, CalendarCheck2 } from "lucide-react";
import { labelEstado, badgeEstado } from "@/lib/estados";
import { labelEstadoPeriodo, badgeEstadoPeriodo } from "@/lib/estados/cobros";
import { formatFechaCorta as fmtFecha } from "@/lib/dates";
import type { SaludFinanciera } from "@/lib/proyectos/salud";

export type CotizacionProyectoRow = {
  id: string;
  nombre: string;
  estado: string;
  created_at: string;
  monto: number | null;
};

export type CobroProyectoRow = {
  id: string;
  titulo: string;
  origen: "desarrollo" | "soporte";
  estado: string;
  etiqueta: string;
  monto: number;
  moneda: string;
  created_at: string;
  tipoPago: "unico" | "parcialidades" | "mensual";
  pagos: { monto: number; fecha: string }[];
};

type Tab = "detalle" | "cotizaciones" | "cobros" | "salud";

function fmtMonto(n: number, moneda: string = "MXN"): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function inicioDeMes(offsetMeses: number): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offsetMeses, 1);
}

function finDeMes(offsetMeses: number): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offsetMeses + 1, 0, 23, 59, 59, 999);
}

type RangoRapido = "" | "este_mes" | "mes_pasado" | "personalizado";

function useFiltrosFecha() {
  const [rango, setRango] = useState<RangoRapido>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const enRango = (iso: string): boolean => {
    if (!rango) return true;
    const t = new Date(iso).getTime();
    if (rango === "este_mes") return t >= inicioDeMes(0).getTime() && t <= finDeMes(0).getTime();
    if (rango === "mes_pasado") return t >= inicioDeMes(-1).getTime() && t <= finDeMes(-1).getTime();
    if (rango === "personalizado") {
      if (desde && t < new Date(`${desde}T00:00:00`).getTime()) return false;
      if (hasta && t > new Date(`${hasta}T23:59:59`).getTime()) return false;
      return true;
    }
    return true;
  };

  return { rango, setRango, desde, setDesde, hasta, setHasta, enRango };
}

function BarraFecha({
  rango,
  setRango,
  desde,
  setDesde,
  hasta,
  setHasta,
}: ReturnType<typeof useFiltrosFecha>) {
  return (
    <>
      <div>
        <label className="field-label">Fecha</label>
        <select
          className="input"
          value={rango}
          onChange={(e) => setRango(e.target.value as RangoRapido)}
        >
          <option value="">Todas</option>
          <option value="este_mes">Este mes</option>
          <option value="mes_pasado">Mes pasado</option>
          <option value="personalizado">Personalizado</option>
        </select>
      </div>
      {rango === "personalizado" && (
        <>
          <div>
            <label className="field-label">Desde</label>
            <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Hasta</label>
            <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </>
      )}
    </>
  );
}

export default function ProyectoTabs({
  detalle,
  cotizaciones,
  cobros,
  salud,
}: {
  detalle: ReactNode;
  cotizaciones: CotizacionProyectoRow[];
  cobros: CobroProyectoRow[];
  salud: SaludFinanciera;
}) {
  const [tab, setTab] = useState<Tab>("detalle");

  const TABS: { value: Tab; label: string; icon: typeof FileText }[] = [
    { value: "detalle", label: "Detalle", icon: LayoutList },
    { value: "cotizaciones", label: "Cotizaciones", icon: FileText },
    { value: "cobros", label: "Cobros", icon: Wallet },
    { value: "salud", label: "Salud financiera", icon: Activity },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b overflow-x-auto overflow-y-hidden" style={{ borderColor: "var(--border-subtle)" }}>
        {TABS.map((t) => (
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
            <t.icon size={14} strokeWidth={1.75} />
            {t.label}
          </button>
        ))}
      </div>

      <div hidden={tab !== "detalle"}>{detalle}</div>
      <div hidden={tab !== "cotizaciones"}>
        <TabCotizaciones items={cotizaciones} />
      </div>
      <div hidden={tab !== "cobros"}>
        <TabCobros items={cobros} />
      </div>
      <div hidden={tab !== "salud"}>
        <TabSalud salud={salud} />
      </div>
    </div>
  );
}

function TabCotizaciones({ items }: { items: CotizacionProyectoRow[] }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const fecha = useFiltrosFecha();

  const estadosPresentes = useMemo(
    () => Array.from(new Set(items.map((it) => it.estado))),
    [items]
  );

  const filtrados = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    return items.filter((it) => {
      if (qNorm && !it.nombre.toLowerCase().includes(qNorm)) return false;
      if (estado && it.estado !== estado) return false;
      if (!fecha.enRango(it.created_at)) return false;
      return true;
    });
  }, [items, q, estado, fecha]);

  if (items.length === 0) {
    return (
      <div className="card text-body text-text-secondary text-center py-10">
        Este proyecto todavía no tiene cotizaciones ligadas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="card card-tight">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="field-label">Buscar</label>
            <input
              className="input"
              placeholder="Nombre de la cotización…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Estado</label>
            <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              {estadosPresentes.map((e) => (
                <option key={e} value={e}>
                  {labelEstado(e)}
                </option>
              ))}
            </select>
          </div>
          <BarraFecha {...fecha} />
        </div>
      </section>

      {filtrados.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin cotizaciones que coincidan con los filtros.
        </div>
      ) : (
        <ul
          className="rounded-[14px] overflow-hidden border"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
        >
          <li
            className="hidden md:grid md:grid-cols-[1fr_140px_180px_140px] gap-3 px-4 py-2.5 text-overline text-text-tertiary"
            style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-faint)" }}
          >
            <div>Nombre</div>
            <div>Fecha</div>
            <div>Estatus</div>
            <div>Total</div>
          </li>
          {filtrados.map((it, i) => (
            <li key={it.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
              <Link
                href={`/panel/cotizaciones/${it.id}`}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_180px_140px] gap-3 px-5 py-3 items-center hover:bg-[color:var(--bg-surface)] transition-colors"
              >
                <div className="text-body-medium text-text-primary break-words">{it.nombre}</div>
                <div className="text-caption text-text-tertiary num-tabular">{fmtFecha(it.created_at)}</div>
                <div>
                  <span className={`badge ${badgeEstado(it.estado)}`}>{labelEstado(it.estado)}</span>
                </div>
                <div className="text-caption num-tabular text-text-secondary">
                  {it.monto != null ? fmtMonto(it.monto) : "—"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabCobros({ items }: { items: CobroProyectoRow[] }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const fecha = useFiltrosFecha();

  const estadosPresentes = useMemo(() => Array.from(new Set(items.map((it) => it.estado))), [items]);

  const filtrados = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    return items.filter((it) => {
      if (
        qNorm &&
        !it.titulo.toLowerCase().includes(qNorm) &&
        !it.etiqueta.toLowerCase().includes(qNorm)
      )
        return false;
      if (estado && it.estado !== estado) return false;
      if (!fecha.enRango(it.created_at)) return false;
      return true;
    });
  }, [items, q, estado, fecha]);

  const labelTipoPago = (t: CobroProyectoRow["tipoPago"]) =>
    t === "parcialidades" ? "Parcialidades" : t === "mensual" ? "Mensual" : "Único";

  if (items.length === 0) {
    return (
      <div className="card text-body text-text-secondary text-center py-10">
        Este proyecto todavía no tiene cobros registrados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="card card-tight">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="field-label">Buscar</label>
            <input
              className="input"
              placeholder="Concepto o etiqueta…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Estado</label>
            <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              {estadosPresentes.map((e) => (
                <option key={e} value={e}>
                  {labelEstadoPeriodo(e)}
                </option>
              ))}
            </select>
          </div>
          <BarraFecha {...fecha} />
        </div>
      </section>

      {filtrados.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin cobros que coincidan con los filtros.
        </div>
      ) : (
        <ul
          className="rounded-[14px] overflow-hidden border"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
        >
          <li
            className="hidden md:grid md:grid-cols-[1fr_110px_130px_180px_110px_140px] gap-3 px-4 py-2.5 text-overline text-text-tertiary"
            style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-faint)" }}
          >
            <div>Nombre / concepto</div>
            <div>Tipo</div>
            <div>Tipo de pago</div>
            <div>Estatus</div>
            <div>Fecha</div>
            <div>Total</div>
          </li>
          {filtrados.map((it, i) => (
            <li key={it.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
              <Link
                href={`/panel/cobros/${it.id}`}
                className="grid grid-cols-1 md:grid-cols-[1fr_110px_130px_180px_110px_140px] gap-3 px-5 py-3 items-center hover:bg-[color:var(--bg-surface)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-body-medium text-text-primary break-words">{it.etiqueta}</div>
                  <div className="text-caption text-text-tertiary truncate">{it.titulo}</div>
                </div>
                <div>
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      background: it.origen === "soporte" ? "#CCFBF1" : "#E0E7FF",
                      color: it.origen === "soporte" ? "#0D9488" : "#4F46E5",
                    }}
                  >
                    {it.origen === "soporte" ? "Soporte" : "Desarrollo"}
                  </span>
                </div>
                <div className="text-caption text-text-secondary">{labelTipoPago(it.tipoPago)}</div>
                <div>
                  <span className={`badge ${badgeEstadoPeriodo(it.estado)}`}>{labelEstadoPeriodo(it.estado)}</span>
                </div>
                <div className="text-caption text-text-tertiary num-tabular">{fmtFecha(it.created_at)}</div>
                <div className="text-caption num-tabular text-text-secondary">{fmtMonto(it.monto, it.moneda)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CLASIFICACION_LABEL: Record<SaludFinanciera["clasificacionPago"], string> = {
  rapido: "Paga rápido",
  normal: "Paga en tiempo normal",
  lento: "Paga lento",
  sin_datos: "Sin datos suficientes",
};

const CLASIFICACION_COLOR: Record<SaludFinanciera["clasificacionPago"], string> = {
  rapido: "var(--state-success)",
  normal: "var(--state-warning)",
  lento: "var(--state-error)",
  sin_datos: "var(--text-tertiary)",
};

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Barras de lo cobrado mes a mes en el año en curso — deja ver de un
// vistazo si el cliente paga de forma constante o de forma irregular
// (meses en cero entre meses con actividad).
function GraficaConstanciaMensual({ porMes }: { porMes: { mes: number; monto: number }[] }) {
  const max = Math.max(...porMes.map((m) => m.monto), 1);
  const mesActualIdx = new Date().getMonth();
  const anioActual = new Date().getFullYear();

  return (
    <div className="card space-y-3">
      <h2 className="text-heading-2">Constancia de cobro — {anioActual}</h2>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: 150 }}>
        {porMes.map((m, i) => {
          const esFuturo = i > mesActualIdx;
          const alturaPct = m.monto > 0 ? Math.max(4, (m.monto / max) * 100) : 0;
          return (
            <div key={m.mes} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 min-w-0">
              <span className="text-caption num-tabular text-text-tertiary truncate" style={{ fontSize: 10 }}>
                {m.monto > 0 ? fmtMonto(m.monto) : ""}
              </span>
              <div className="w-full flex items-end" style={{ height: 96 }}>
                <div
                  className="w-full rounded-t-[4px]"
                  title={`${NOMBRES_MES[i]} ${anioActual}: ${fmtMonto(m.monto)}`}
                  style={{
                    height: `${alturaPct}%`,
                    minHeight: m.monto > 0 ? 3 : 0,
                    background: esFuturo
                      ? "transparent"
                      : m.monto > 0
                      ? "var(--accent)"
                      : "var(--border-default)",
                    border: esFuturo ? "1px dashed var(--border-subtle)" : "none",
                  }}
                />
              </div>
              <span
                className="text-caption"
                style={{
                  fontSize: 11,
                  color: i === mesActualIdx ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontWeight: i === mesActualIdx ? 600 : 400,
                }}
              >
                {NOMBRES_MES[i]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-caption text-text-tertiary">
        Barras vacías = mes sin ningún pago registrado. Punteado = todavía no llega.
      </p>
    </div>
  );
}

function TabSalud({ salud }: { salud: SaludFinanciera }) {
  if (salud.totalPeriodos === 0) {
    return (
      <div className="card text-body text-text-secondary text-center py-10">
        Todavía no hay cobros registrados para calcular la salud financiera de este proyecto.
      </div>
    );
  }

  const maxTop = Math.max(...salud.topFacturas.map((f) => f.monto), 1);
  const maxEstado = Math.max(...salud.distribucionEstado.map((d) => d.monto), 1);

  const kpis: {
    label: string;
    value: string;
    icon: typeof Clock;
    iconBg: string;
    iconFg: string;
    sub?: string;
    subColor?: string;
  }[] = [
    {
      label: "Duración promedio de pago",
      value: salud.duracionPromedioDias != null ? `${salud.duracionPromedioDias} días` : "—",
      icon: Clock,
      iconBg: "#FEF3C7",
      iconFg: "#B45309",
      sub: CLASIFICACION_LABEL[salud.clasificacionPago],
      subColor: CLASIFICACION_COLOR[salud.clasificacionPago],
    },
    {
      label: "Frecuencia de cobros",
      value: `${salud.frecuenciaPorMes ?? "—"}/mes`,
      icon: Repeat,
      iconBg: "#DBEAFE",
      iconFg: "#1D4ED8",
      sub: `activo hace ${salud.mesesActivo} ${salud.mesesActivo === 1 ? "mes" : "meses"}`,
    },
    {
      label: "Total de cobros",
      value: String(salud.totalPeriodos),
      icon: ListChecks,
      iconBg: "#DCFCE7",
      iconFg: "#15803D",
      sub: "períodos registrados en total",
    },
    {
      label: "Constancia este año",
      value: `${salud.mesesConActividadEsteAnio}/${salud.mesesTranscurridosEsteAnio}`,
      icon: CalendarCheck2,
      iconBg: "#EDE9FE",
      iconFg: "#6D28D9",
      sub: "meses con cobro registrado",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        {kpis.map((k) => (
          <div key={k.label} className="card card-hover">
            <div className="flex items-center gap-2">
              <span
                className="grid place-items-center flex-shrink-0"
                style={{ width: 27, height: 27, borderRadius: "50%", background: k.iconBg, color: k.iconFg }}
              >
                <k.icon size={13.5} strokeWidth={1.9} />
              </span>
              <span className="text-caption" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                {k.label}
              </span>
            </div>
            <div
              className="num-tabular"
              style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-1.1px", lineHeight: 1.1, marginTop: 13 }}
            >
              {k.value}
            </div>
            {k.sub && (
              <div
                className="text-caption"
                style={{
                  color: k.subColor ?? "var(--text-tertiary)",
                  marginTop: 11,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border-faint)",
                  fontWeight: k.subColor ? 500 : 400,
                }}
              >
                {k.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <GraficaConstanciaMensual porMes={salud.porMes} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="text-heading-2">Facturas / cotizaciones más altas</h2>
          {salud.topFacturas.length === 0 ? (
            <p className="text-caption text-text-tertiary">Sin datos.</p>
          ) : (
            <div className="space-y-2.5">
              {salud.topFacturas.map((f, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between gap-2 text-caption mb-1">
                    <span className="text-text-primary truncate">{f.etiqueta}</span>
                    <span className="num-tabular text-text-secondary shrink-0">{fmtMonto(f.monto, f.moneda)}</span>
                  </div>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 6, background: "var(--bg-overlay)" }}
                  >
                    <div
                      style={{
                        width: `${Math.max(4, (f.monto / maxTop) * 100)}%`,
                        height: "100%",
                        background: "var(--accent)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="text-heading-2">Distribución por estatus</h2>
          {salud.distribucionEstado.length === 0 ? (
            <p className="text-caption text-text-tertiary">Sin datos.</p>
          ) : (
            <div className="space-y-2.5">
              {salud.distribucionEstado.map((d) => (
                <div key={d.estado}>
                  <div className="flex items-center justify-between gap-2 text-caption mb-1">
                    <span className="text-text-primary">
                      {labelEstadoPeriodo(d.estado)} · {d.count}
                    </span>
                    <span className="num-tabular text-text-secondary shrink-0">{fmtMonto(d.monto)}</span>
                  </div>
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 6, background: "var(--bg-overlay)" }}
                  >
                    <div
                      style={{
                        width: `${Math.max(4, (d.monto / maxEstado) * 100)}%`,
                        height: "100%",
                        background: "var(--accent)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
