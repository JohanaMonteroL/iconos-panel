import Link from "next/link";
import { AlertTriangle, Wallet, CalendarDays, CalendarRange, MoreHorizontal } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { labelPeriodicidad } from "@/lib/pagos/labels";
import { fmtMXN } from "@/lib/pagos/calculos";
import { estaPagadoEnPeriodoActual } from "@/lib/pagos/periodo";
import PagoFormModal from "@/components/forms/PagoFormModal";
import FiltrosPagos from "./FiltrosPagos";
import type { Pago } from "@/types/db";

export const dynamic = "force-dynamic";

function relationMissing(message: string | undefined | null): boolean {
  if (!message) return false;
  // Postgres directo dice "relation ... does not exist"; PostgREST, cuando
  // la tabla no está en su caché de esquema (el caso normal si la migración
  // nunca se corrió), dice "Could not find the table ... in the schema cache".
  return /relation .* does not exist/i.test(message) || /could not find the table/i.test(message);
}

async function getPagos(todos: boolean): Promise<{ items: Pago[]; migracionPendiente: boolean }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { items: [], migracionPendiente: false };
  const supa = createSupabaseServiceClient();
  let query = supa.from("pagos_proveedores").select("*").order("orden").order("nombre_pago");
  if (!todos) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) {
    if (relationMissing(error.message)) return { items: [], migracionPendiente: true };
    console.error("[pagos] error:", error);
    return { items: [], migracionPendiente: false };
  }
  return { items: (data ?? []) as Pago[], migracionPendiente: false };
}

function sumaTotal(items: Pago[]): number {
  return items.reduce((acc, p) => acc + (Number(p.total_a_pagar) || 0), 0);
}

export default async function PagosPage({
  searchParams,
}: {
  searchParams: { todos?: string; q?: string; periodicidad?: string; pago?: string; orden?: string };
}) {
  const todos = searchParams.todos === "1";
  const { items: base, migracionPendiente } = await getPagos(todos);

  const q = searchParams.q?.trim().toLowerCase() || null;
  const periodicidad = searchParams.periodicidad || null;
  const pagoFiltro = searchParams.pago || null;
  const orden = searchParams.orden || null;

  const items = base
    .filter((p) => {
      if (q && !p.nombre_pago.toLowerCase().includes(q) && !(p.empresa_contacto ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (periodicidad && p.periodicidad !== periodicidad) return false;
      if (pagoFiltro) {
        const pagado = estaPagadoEnPeriodoActual(p.periodicidad, p.ultimo_pago_marcado);
        if (pagoFiltro === "pagado" && !pagado) return false;
        if (pagoFiltro === "pendiente" && pagado) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (orden === "monto") return b.total_a_pagar - a.total_a_pagar;
      if (orden === "periodicidad") return a.periodicidad.localeCompare(b.periodicidad);
      return a.nombre_pago.localeCompare(b.nombre_pago, "es", { sensitivity: "base" });
    });

  // Contadores — siempre sobre el set base (Activos/Todos), sin que los
  // afecten la búsqueda/periodicidad/estado de pago de abajo: son el
  // resumen general, no un total de lo filtrado. El monto es el dato
  // principal de cada tarjeta; el conteo queda como referencia abajo.
  const mensuales = base.filter((p) => p.periodicidad === "mensual");
  const anuales = base.filter((p) => p.periodicidad === "anual");
  const otros = base.filter((p) => p.periodicidad !== "mensual" && p.periodicidad !== "anual");

  const contador = (n: number) => `${n} pago${n === 1 ? "" : "s"}`;

  const kpis: { label: string; value: string; icon: typeof Wallet; iconBg: string; iconFg: string; sub: string }[] = [
    { label: "Total de pagos", value: fmtMXN(sumaTotal(base)), icon: Wallet, iconBg: "#DBEAFE", iconFg: "#1D4ED8", sub: contador(base.length) },
    { label: "Pagos mensuales", value: fmtMXN(sumaTotal(mensuales)), icon: CalendarDays, iconBg: "#DCFCE7", iconFg: "#15803D", sub: contador(mensuales.length) },
    { label: "Pagos anuales", value: fmtMXN(sumaTotal(anuales)), icon: CalendarRange, iconBg: "#FEF3C7", iconFg: "#B45309", sub: contador(anuales.length) },
    { label: "Otros pagos", value: fmtMXN(sumaTotal(otros)), icon: MoreHorizontal, iconBg: "#EDE9FE", iconFg: "#6D28D9", sub: contador(otros.length) },
  ];

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Pagos</h1>
          <p className="text-body text-text-secondary">
            Catálogo de pagos a proveedores externos — abre uno para copiar sus datos y
            ejecutar el pago. La gestión del trabajo sigue en ClickUp.
          </p>
        </div>
        {!migracionPendiente && <PagoFormModal />}
      </header>

      {migracionPendiente ? (
        <div className="card flex items-start gap-3">
          <AlertTriangle size={20} strokeWidth={1.75} style={{ color: "var(--state-warning, #B45309)" }} />
          <div>
            <p className="text-body-medium">Falta correr la migración de Pagos</p>
            <p className="text-caption text-text-secondary mt-1">
              Corre <code>supabase/migrations/0029_pagos_proveedores.sql</code>,{" "}
              <code>0030_pagos_proveedores_pagado.sql</code> y{" "}
              <code>0031_pagos_proveedores_registro.sql</code> en el SQL Editor de Supabase para
              activar esta sección.
            </p>
          </div>
        </div>
      ) : base.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin pagos todavía. Usa &quot;Nuevo pago&quot; arriba para capturar el primero.
        </div>
      ) : (
        <>
          <div className="escalonado grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
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
                  style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.8px", lineHeight: 1.1, marginTop: 13 }}
                >
                  {k.value}
                </div>
                <div
                  className="text-caption"
                  style={{ color: "var(--text-tertiary)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
                >
                  {k.sub}
                </div>
              </div>
            ))}
          </div>

          <FiltrosPagos
            actuales={{ q: searchParams.q ?? null, periodicidad, pago: pagoFiltro, orden, todos }}
          />

          {items.length === 0 ? (
            <div className="card text-body text-text-secondary text-center py-10">
              Sin pagos que coincidan con los filtros.
            </div>
          ) : (
            <ul
              className="rounded-[14px] overflow-hidden border"
              style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
            >
              <li
                className="hidden md:grid md:grid-cols-[1.4fr_1.1fr_0.9fr_0.9fr_0.8fr] gap-3 px-4 py-2.5 text-overline text-text-tertiary"
                style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-faint)" }}
              >
                <div>Nombre</div>
                <div>Empresa / contacto</div>
                <div>Periodicidad</div>
                <div style={{ textAlign: "right" }}>Total a pagar</div>
                <div style={{ textAlign: "right" }}>Pago</div>
              </li>
              {items.map((p, i) => {
                const pagado = estaPagadoEnPeriodoActual(p.periodicidad, p.ultimo_pago_marcado);
                return (
                  <li key={p.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
                    <Link
                      href={`/panel/pagos/${p.id}`}
                      className="grid grid-cols-1 md:grid-cols-[1.4fr_1.1fr_0.9fr_0.9fr_0.8fr] gap-2 px-4 py-3 items-center hover:bg-[color:var(--bg-surface)] transition-colors"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="text-body-medium text-text-primary break-words">{p.nombre_pago}</div>
                          <div className="text-caption text-text-tertiary md:hidden mt-0.5">
                            {p.empresa_contacto || "—"} · {labelPeriodicidad(p.periodicidad)}
                          </div>
                        </div>
                        {!p.activo && <span className="badge badge-neutral flex-shrink-0">Inactivo</span>}
                      </div>
                      <div className="hidden md:block text-caption text-text-secondary break-words">
                        {p.empresa_contacto || "—"}
                      </div>
                      <div className="hidden md:block">
                        <span className="badge badge-neutral">{labelPeriodicidad(p.periodicidad)}</span>
                      </div>
                      <div className="text-caption text-text-secondary num-tabular" style={{ textAlign: "right" }}>
                        {fmtMXN(p.total_a_pagar)}
                      </div>
                      <div className="flex md:block" style={{ justifyContent: "flex-end" }}>
                        <span className={`badge ${pagado ? "badge-success" : "badge-warning"}`}>
                          {pagado ? "Pagado" : "Pendiente"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
