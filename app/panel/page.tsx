import Link from "next/link";
import { FileText, Inbox, Plus } from "lucide-react";
import EnablePushButton from "@/components/ui/EnablePushButton";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ESTADOS_ESTIMACION_ACTIVA } from "@/lib/estados";

export const dynamic = "force-dynamic";

async function getCounts() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { pendientes: 0, cotizacionesActivas: 0 };
  const supa = createSupabaseServiceClient();

  // Estimaciones "por revisar" = cotizaciones en etapa temprana
  // (por_estimar / pendiente_revision_interna) que Johana no ha abierto aún.
  // Coincide con el badge del sidebar.
  const { count: pendCount } = await supa
    .from("cotizaciones")
    .select("id", { count: "exact", head: true })
    .is("revisada_at", null)
    .in("estado", ESTADOS_ESTIMACION_ACTIVA);

  const { count: cot } = await supa
    .from("cotizaciones")
    .select("id", { count: "exact", head: true })
    .neq("estado", "archivada");

  return { pendientes: pendCount ?? 0, cotizacionesActivas: cot ?? 0 };
}

export default async function PanelHome() {
  const { pendientes, cotizacionesActivas } = await getCounts();

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-display">Hola Johana</h1>
          <p className="text-body text-text-secondary">Resumen de actividad</p>
        </div>
        <AutoRefresh intervalSeconds={15} />
      </header>

      {/* Métricas */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <Link href="/panel/cotizaciones" className="card card-hover" style={{ display: "block" }}>
          <div className="flex items-center gap-2">
            <span
              className="grid place-items-center flex-shrink-0"
              style={{ width: 27, height: 27, borderRadius: "50%", background: "#DBEAFE", color: "#1D4ED8" }}
            >
              <FileText size={13.5} strokeWidth={1.9} />
            </span>
            <span className="text-caption" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
              Cotizaciones activas
            </span>
          </div>
          <div
            className="num-tabular"
            style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-1.1px", lineHeight: 1.1, marginTop: 13 }}
          >
            {cotizacionesActivas}
          </div>
          <div
            className="text-caption"
            style={{ color: "var(--text-tertiary)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
          >
            Sin archivar
          </div>
        </Link>
        <Link href="/panel/cotizaciones?vista=board" className="card card-hover" style={{ display: "block" }}>
          <div className="flex items-center gap-2">
            <span
              className="grid place-items-center flex-shrink-0"
              style={{ width: 27, height: 27, borderRadius: "50%", background: "#FEF3C7", color: "#B45309" }}
            >
              <Inbox size={13.5} strokeWidth={1.9} />
            </span>
            <span className="text-caption" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
              Estimaciones por revisar
            </span>
          </div>
          <div
            className="num-tabular"
            style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-1.1px", lineHeight: 1.1, marginTop: 13 }}
          >
            {pendientes}
          </div>
          <div
            className="text-caption"
            style={{ color: "var(--text-tertiary)", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--border-faint)" }}
          >
            Sin cotización asignada
          </div>
        </Link>
      </section>

      {/* Acciones rápidas */}
      <section className="space-y-4">
        <h2 className="text-heading-2">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/estimaciones/nueva" className="btn-primary">
            <Plus size={16} strokeWidth={1.5} />
            <span>Capturar estimación</span>
          </Link>
          <Link href="/panel/cotizaciones" className="btn-secondary">
            Ver cotizaciones
          </Link>
          <Link href="/panel/cotizaciones?vista=board" className="btn-secondary">
            Ver pendientes
          </Link>
        </div>
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
