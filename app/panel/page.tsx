import Link from "next/link";
import {
  ArrowRight,
  Inbox,
  ClipboardList,
  Send,
  ShieldCheck,
  TrendingUp,
  Trophy,
} from "lucide-react";
import EnablePushButton from "@/components/ui/EnablePushButton";
import AutoRefresh from "@/components/ui/AutoRefresh";
import GraficaLineas from "@/components/ui/GraficaLineas";
import BarrasHorizontales from "@/components/ui/BarrasHorizontales";
import InicioKpis, { type KpiMes } from "./InicioKpis";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { labelEstado, badgeEstado } from "@/lib/estados";
import { montoCotizacion } from "@/lib/cotizaciones/calculos";
import { ultimosMeses, claveMes, fmtMxn, fmtMxnCompacto } from "@/lib/dashboard/calculos";

export const dynamic = "force-dynamic";

const N_MESES = 12;

type CotizacionRow = {
  id: string;
  nombre: string;
  estado: string;
  created_at: string;
  horas_envio: number | null;
  tipo_precio: string | null;
  monto_fijo: number | null;
  proyecto_clickup_id: string | null;
  proyecto_nombre: string | null;
  programador_id: string | null;
  programadores: { nombre: string } | null;
};

type ProyectoRow = { id: string; nombre: string; color: string | null; emoji: string | null; precio_hora_venta: number | null };
type CobroRow = { id: string; origen: string; proyecto_id: string | null; cotizacion_id: string | null; titulo: string };
type PeriodoRow = { id: string; cobro_id: string; estado: string; etiqueta: string; monto: number; moneda: string; created_at: string };
type PagoRow = { id: string; periodo_id: string; monto: number; fecha: string };
type ProgramadorRow = { id: string; nombre: string };

async function getDatos() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      cotizaciones: [] as CotizacionRow[],
      proyectos: [] as ProyectoRow[],
      cobros: [] as CobroRow[],
      periodos: [] as PeriodoRow[],
      pagos: [] as PagoRow[],
      programadores: [] as ProgramadorRow[],
    };
  }
  const supa = createSupabaseServiceClient();

  const [cotRes, proyRes, cobRes, perRes, pagRes, progRes] = await Promise.all([
    supa
      .from("cotizaciones")
      .select(
        "id, nombre, estado, created_at, horas_envio, tipo_precio, monto_fijo, proyecto_clickup_id, proyecto_nombre, programador_id, programadores(nombre)"
      )
      .neq("estado", "archivada")
      .order("created_at", { ascending: false })
      .limit(1000),
    supa.from("proyectos").select("id, nombre, color, emoji, precio_hora_venta"),
    supa.from("cobros").select("id, origen, proyecto_id, cotizacion_id, titulo"),
    supa.from("cobros_periodos").select("id, cobro_id, estado, etiqueta, monto, moneda, created_at"),
    supa.from("cobros_pagos").select("id, periodo_id, monto, fecha"),
    supa.from("programadores").select("id, nombre"),
  ]);

  return {
    cotizaciones: ((cotRes.data ?? []) as any[]).map((c) => ({
      ...c,
      programadores: Array.isArray(c.programadores) ? c.programadores[0] ?? null : c.programadores,
    })) as CotizacionRow[],
    proyectos: (proyRes.data ?? []) as ProyectoRow[],
    cobros: (cobRes.data ?? []) as CobroRow[],
    periodos: ((perRes.data ?? []) as any[]).map((p) => ({ ...p, monto: Number(p.monto) || 0 })) as PeriodoRow[],
    pagos: ((pagRes.data ?? []) as any[]).map((p) => ({ ...p, monto: Number(p.monto) || 0 })) as PagoRow[],
    programadores: (progRes.data ?? []) as ProgramadorRow[],
  };
}

export default async function PanelHome() {
  const { cotizaciones, proyectos, cobros, periodos, pagos, programadores } = await getDatos();

  const proyectoPorId = new Map(proyectos.map((p) => [p.id, p]));
  const cobroPorId = new Map(cobros.map((c) => [c.id, c]));
  const cobroPorCotizacionId = new Map(cobros.filter((c) => c.cotizacion_id).map((c) => [c.cotizacion_id as string, c]));
  const periodosPorCobroId = new Map<string, PeriodoRow[]>();
  for (const p of periodos) {
    const arr = periodosPorCobroId.get(p.cobro_id) ?? [];
    arr.push(p);
    periodosPorCobroId.set(p.cobro_id, arr);
  }
  const pagosPorPeriodoId = new Map<string, PagoRow[]>();
  for (const pg of pagos) {
    const arr = pagosPorPeriodoId.get(pg.periodo_id) ?? [];
    arr.push(pg);
    pagosPorPeriodoId.set(pg.periodo_id, arr);
  }
  const montoPagadoDePeriodo = (periodoId: string) =>
    (pagosPorPeriodoId.get(periodoId) ?? []).reduce((acc, p) => acc + p.monto, 0);

  const montoDeCotizacion = (c: CotizacionRow): number | null =>
    montoCotizacion(c, c.proyecto_clickup_id ? proyectoPorId.get(c.proyecto_clickup_id)?.precio_hora_venta : undefined);

  const montoCobradoDeCotizacion = (cotizacionId: string): number => {
    const cobro = cobroPorCotizacionId.get(cotizacionId);
    if (!cobro) return 0;
    const pers = periodosPorCobroId.get(cobro.id) ?? [];
    return pers.reduce((acc, per) => acc + montoPagadoDePeriodo(per.id), 0);
  };

  // ── 1) KPIs "por mes" (últimos 12, incluye el actual) ──────────────────
  const meses = ultimosMeses(N_MESES);
  const bucketVacio = () => ({
    cobradoMonto: 0,
    cobradoCotiz: new Set<string>(),
    pendienteMonto: 0,
    pendienteCotiz: new Set<string>(),
    enDesarrolloCount: 0,
    cotizadoMonto: 0,
    cotizadoCount: 0,
  });
  const porMesMap = new Map(meses.map((m) => [m.key, bucketVacio()]));

  for (const c of cotizaciones) {
    const key = claveMes(c.created_at);
    const b = porMesMap.get(key);
    if (!b) continue;
    const monto = montoDeCotizacion(c) ?? 0;
    b.cotizadoMonto += monto;
    b.cotizadoCount += 1;
    if (c.estado === "en_desarrollo") b.enDesarrolloCount += 1;
  }

  for (const per of periodos) {
    const key = claveMes(per.created_at);
    const b = porMesMap.get(key);
    if (!b) continue;
    const pendiente = Math.max(per.monto - montoPagadoDePeriodo(per.id), 0);
    if (pendiente > 0) {
      b.pendienteMonto += pendiente;
      const cobro = cobroPorId.get(per.cobro_id);
      if (cobro?.cotizacion_id) b.pendienteCotiz.add(cobro.cotizacion_id);
    }
  }

  for (const pg of pagos) {
    const key = claveMes(pg.fecha);
    const b = porMesMap.get(key);
    if (!b) continue;
    b.cobradoMonto += pg.monto;
    const per = periodos.find((p) => p.id === pg.periodo_id);
    const cobro = per ? cobroPorId.get(per.cobro_id) : undefined;
    if (cobro?.cotizacion_id) b.cobradoCotiz.add(cobro.cotizacion_id);
  }

  const porMes: KpiMes[] = meses.map((m) => {
    const b = porMesMap.get(m.key)!;
    return {
      key: m.key,
      label: m.label,
      cobradoMonto: b.cobradoMonto,
      cobradoCount: b.cobradoCotiz.size,
      pendienteMonto: b.pendienteMonto,
      pendienteCount: b.pendienteCotiz.size,
      enDesarrolloCount: b.enDesarrolloCount,
      cotizadoMonto: b.cotizadoMonto,
      cotizadoCount: b.cotizadoCount,
    };
  });

  // ── 2) Gráfica: cobrado vs. cotizado por mes ────────────────────────────
  const serieCobrado = porMes.map((m) => m.cobradoMonto);
  const serieCotizado = porMes.map((m) => m.cotizadoMonto);

  // ── 3) Top cotizaciones ya enviadas al cliente ──────────────────────────
  const ESTADOS_SEGUIMIENTO = ["enviada", "aprobada", "en_desarrollo"];
  const topEnviadas = cotizaciones
    .filter((c) => ESTADOS_SEGUIMIENTO.includes(c.estado))
    .map((c) => ({ c, monto: montoDeCotizacion(c) ?? 0 }))
    .filter((x) => x.monto > 0)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 6);

  // ── 4) Top pagos pendientes de cobro ────────────────────────────────────
  const topPendientes = periodos
    .map((per) => {
      const pendiente = Math.max(per.monto - montoPagadoDePeriodo(per.id), 0);
      const cobro = cobroPorId.get(per.cobro_id);
      const proyecto = cobro?.proyecto_id ? proyectoPorId.get(cobro.proyecto_id) : undefined;
      return { per, cobro, proyecto, pendiente };
    })
    .filter((x) => x.pendiente > 0)
    .sort((a, b) => b.pendiente - a.pendiente)
    .slice(0, 6);

  // ── 5) Top proyectos con Soporte por dinero facturado ───────────────────
  const soportePorProyecto = new Map<string, number>();
  for (const per of periodos) {
    const cobro = cobroPorId.get(per.cobro_id);
    if (cobro?.origen !== "soporte" || !cobro.proyecto_id) continue;
    soportePorProyecto.set(cobro.proyecto_id, (soportePorProyecto.get(cobro.proyecto_id) ?? 0) + per.monto);
  }
  const topSoporte = Array.from(soportePorProyecto.entries())
    .map(([proyectoId, monto]) => ({ proyecto: proyectoPorId.get(proyectoId), monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 6);

  // ── 6) Top 5 clientes que más han pagado ────────────────────────────────
  const pagadoPorProyecto = new Map<string, number>();
  for (const pg of pagos) {
    const per = periodos.find((p) => p.id === pg.periodo_id);
    const cobro = per ? cobroPorId.get(per.cobro_id) : undefined;
    if (!cobro?.proyecto_id) continue;
    pagadoPorProyecto.set(cobro.proyecto_id, (pagadoPorProyecto.get(cobro.proyecto_id) ?? 0) + pg.monto);
  }
  const topClientes = Array.from(pagadoPorProyecto.entries())
    .map(([proyectoId, monto]) => ({ proyecto: proyectoPorId.get(proyectoId), monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  // ── 7-9) Secciones rápidas de estimaciones ──────────────────────────────
  const porEstimar = cotizaciones.filter((c) => c.estado === "por_estimar");
  const porRevisar = cotizaciones.filter((c) => c.estado === "pendiente_revision_interna");
  const porAprobar = cotizaciones.filter((c) => c.estado === "esperando_aprobacion");

  // ── 10) Top programadores por dinero YA cobrado de lo que estimaron ────
  const progAgg = new Map<string, { nombre: string; estimado: number; cobrado: number }>();
  for (const c of cotizaciones) {
    if (!c.programador_id) continue;
    const nombre = c.programadores?.nombre ?? programadores.find((p) => p.id === c.programador_id)?.nombre ?? "—";
    const cur = progAgg.get(c.programador_id) ?? { nombre, estimado: 0, cobrado: 0 };
    cur.estimado += montoDeCotizacion(c) ?? 0;
    cur.cobrado += montoCobradoDeCotizacion(c.id);
    progAgg.set(c.programador_id, cur);
  }
  const topProgramadores = Array.from(progAgg.values())
    .filter((p) => p.estimado > 0 || p.cobrado > 0)
    .sort((a, b) => b.cobrado - a.cobrado || b.estimado - a.estimado)
    .slice(0, 6);

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-display">Hola Johana</h1>
          <p className="text-body text-text-secondary">Resumen de actividad</p>
        </div>
        <AutoRefresh intervalSeconds={30} />
      </header>

      <InicioKpis porMes={porMes} />

      {/* Gráfica cobros vs. cotizaciones por mes */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="grid place-items-center flex-shrink-0"
            style={{ width: 27, height: 27, borderRadius: "50%", background: "#DBEAFE", color: "#1D4ED8" }}
          >
            <TrendingUp size={13.5} strokeWidth={1.9} />
          </span>
          <h2 className="text-heading-2">Cobros y cotizaciones por mes</h2>
        </div>
        <GraficaLineas
          etiquetas={porMes.map((m) => m.label)}
          series={[
            { key: "cobrado", label: "Cobrado", color: "#16A34A", valores: serieCobrado },
            { key: "cotizado", label: "Cotizado", color: "#6366F1", valores: serieCotizado },
          ]}
        />
      </section>

      {/* Tops de seguimiento de cobranza */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card space-y-3">
          <h2 className="text-heading-2">Top cotizaciones enviadas al cliente</h2>
          <p className="text-caption text-text-tertiary -mt-2">Para dar seguimiento — de mayor a menor monto.</p>
          {topEnviadas.length === 0 ? (
            <p className="text-caption text-text-tertiary">Sin cotizaciones enviadas con monto calculable.</p>
          ) : (
            <ul className="space-y-1">
              {topEnviadas.map(({ c, monto }, i) => (
                <li key={c.id}>
                  <Link
                    href={`/panel/cotizaciones/${c.id}`}
                    className="flex items-center gap-3 rounded-[9px] px-2 py-2 hover:bg-[color:var(--bg-surface)] transition-colors"
                  >
                    <span className="text-caption text-text-tertiary w-4 text-center shrink-0">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-medium truncate">{c.nombre}</span>
                      <span className="text-caption text-text-tertiary truncate">
                        {c.proyecto_nombre ?? "—"} ·{" "}
                        <span className={`badge ${badgeEstado(c.estado)}`} style={{ marginLeft: 2 }}>
                          {labelEstado(c.estado)}
                        </span>
                      </span>
                    </span>
                    <span className="num-tabular text-body-medium shrink-0">{fmtMxn(monto)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="text-heading-2">Top pagos pendientes de cobro</h2>
          <p className="text-caption text-text-tertiary -mt-2">De mayor a menor monto pendiente.</p>
          {topPendientes.length === 0 ? (
            <p className="text-caption text-text-tertiary">Sin pendientes — todo cobrado 🎉</p>
          ) : (
            <ul className="space-y-1">
              {topPendientes.map(({ per, cobro, proyecto, pendiente }, i) => (
                <li key={per.id}>
                  <Link
                    href={`/panel/cobros/${per.id}`}
                    className="flex items-center gap-3 rounded-[9px] px-2 py-2 hover:bg-[color:var(--bg-surface)] transition-colors"
                  >
                    <span className="text-caption text-text-tertiary w-4 text-center shrink-0">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-medium truncate">{per.etiqueta}</span>
                      <span className="text-caption text-text-tertiary truncate">
                        {proyecto?.emoji ? `${proyecto.emoji} ` : ""}
                        {proyecto?.nombre ?? cobro?.titulo ?? "—"}
                      </span>
                    </span>
                    <span className="num-tabular text-body-medium shrink-0" style={{ color: "var(--state-error)" }}>
                      {fmtMxn(pendiente)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Tops con barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card space-y-3">
          <h2 className="text-heading-2">Top proyectos con Soporte</h2>
          <p className="text-caption text-text-tertiary -mt-2">Dinero facturado — solo Soporte.</p>
          <BarrasHorizontales
            formatear={fmtMxnCompacto}
            filas={topSoporte.map(({ proyecto, monto }, i) => ({
              key: proyecto?.id ?? String(i),
              label: `${proyecto?.emoji ? proyecto.emoji + " " : ""}${proyecto?.nombre ?? "—"}`,
              valor: monto,
              color: "#0D9488",
            }))}
          />
        </section>

        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <Trophy size={15} strokeWidth={1.75} style={{ color: "#B45309" }} />
            <h2 className="text-heading-2">Top 5 clientes</h2>
          </div>
          <p className="text-caption text-text-tertiary -mt-2">Los que más dinero han pagado en total.</p>
          <BarrasHorizontales
            formatear={fmtMxnCompacto}
            filas={topClientes.map(({ proyecto, monto }, i) => ({
              key: proyecto?.id ?? String(i),
              label: `${proyecto?.emoji ? proyecto.emoji + " " : ""}${proyecto?.nombre ?? "—"}`,
              valor: monto,
              color: "#CA8A04",
            }))}
          />
        </section>
      </div>

      {/* Secciones rápidas de estimaciones */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/panel/cotizaciones?estado=por_estimar" className="card card-hover block space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="grid place-items-center flex-shrink-0"
              style={{ width: 24, height: 24, borderRadius: "50%", background: "#F1F1F3", color: "#52525B" }}
            >
              <ClipboardList size={12.5} strokeWidth={1.9} />
            </span>
            <span className="text-caption" style={{ fontWeight: 500 }}>
              Por estimar
            </span>
          </div>
          <div className="num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
            {porEstimar.length}
          </div>
          <div className="text-caption text-text-tertiary flex items-center gap-1">
            Pendientes por realizar y enviar <ArrowRight size={11} strokeWidth={1.75} />
          </div>
        </Link>

        <Link href="/panel/cotizaciones?estado=pendiente_revision_interna" className="card card-hover block space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="grid place-items-center flex-shrink-0"
              style={{ width: 24, height: 24, borderRadius: "50%", background: "#EDE7FE", color: "#7C3AED" }}
            >
              <Inbox size={12.5} strokeWidth={1.9} />
            </span>
            <span className="text-caption" style={{ fontWeight: 500 }}>
              Por revisar
            </span>
          </div>
          <div className="num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
            {porRevisar.length}
          </div>
          <div className="text-caption text-text-tertiary flex items-center gap-1">
            Enviadas por programadores <ArrowRight size={11} strokeWidth={1.75} />
          </div>
        </Link>

        <Link href="/panel/cotizaciones?estado=esperando_aprobacion" className="card card-hover block space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="grid place-items-center flex-shrink-0"
              style={{ width: 24, height: 24, borderRadius: "50%", background: "#FEF3C7", color: "#B45309" }}
            >
              <ShieldCheck size={12.5} strokeWidth={1.9} />
            </span>
            <span className="text-caption" style={{ fontWeight: 500 }}>
              Por aprobar
            </span>
          </div>
          <div className="num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
            {porAprobar.length}
          </div>
          <div className="text-caption text-text-tertiary flex items-center gap-1">
            Falta el visto bueno de Iván <ArrowRight size={11} strokeWidth={1.75} />
          </div>
        </Link>
      </div>

      {/* Top programadores por dinero ya cobrado */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <Send size={15} strokeWidth={1.75} style={{ color: "#4F46E5" }} />
          <h2 className="text-heading-2">Top programadores por dinero ya cobrado</h2>
        </div>
        <p className="text-caption text-text-tertiary -mt-2">
          Ordenado por lo que ya se cobró de sus estimaciones — no por lo estimado.
        </p>
        {topProgramadores.length === 0 ? (
          <p className="text-caption text-text-tertiary">Sin datos todavía.</p>
        ) : (
          <ul className="space-y-1">
            {topProgramadores.map((p, i) => (
              <li key={p.nombre} className="flex items-center gap-3 px-2 py-2">
                <span className="text-caption text-text-tertiary w-4 text-center shrink-0">{i + 1}</span>
                <span className="min-w-0 flex-1 text-body-medium truncate">{p.nombre}</span>
                <span className="text-caption text-text-tertiary shrink-0">
                  estimado {fmtMxnCompacto(p.estimado)}
                </span>
                <span
                  className="num-tabular text-body-medium shrink-0"
                  style={{ color: "var(--state-success)", minWidth: 80, textAlign: "right" }}
                >
                  {fmtMxn(p.cobrado)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notificaciones */}
      <section className="card space-y-3">
        <div className="space-y-1">
          <h2 className="text-heading-2">Notificaciones push</h2>
          <p className="text-caption text-text-secondary">
            Actívalas en este dispositivo para recibir avisos cuando lleguen estimaciones,
            aprobaciones del jefe o cambios de carril.
          </p>
        </div>
        <EnablePushButton />
      </section>
    </>
  );
}
