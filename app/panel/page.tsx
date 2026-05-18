import Link from "next/link";
import { FileText, Inbox, Plus } from "lucide-react";
import EnablePushButton from "@/components/ui/EnablePushButton";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getCounts() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { pendientes: 0, cotizacionesActivas: 0 };
  const supa = createSupabaseServiceClient();
  const [{ count: pend }, { count: cot }] = await Promise.all([
    supa
      .from("estimaciones_formulario")
      .select("id", { count: "exact", head: true })
      .is("cotizacion_ref", null)
      .in("estado", ["recibida", "procesada_ia"]),
    supa
      .from("cotizaciones")
      .select("id", { count: "exact", head: true })
      .neq("estado", "archivada"),
  ]);
  return { pendientes: pend ?? 0, cotizacionesActivas: cot ?? 0 };
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
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/panel/cotizaciones"
          className="card hover:border-border-strong transition-colors"
          style={{ display: "block" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-overline text-text-tertiary">Cotizaciones activas</div>
              <div className="mt-2 num-tabular" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>
                {cotizacionesActivas}
              </div>
            </div>
            <FileText size={20} strokeWidth={1.5} className="text-text-tertiary" />
          </div>
        </Link>
        <Link
          href="/panel/estimaciones"
          className="card hover:border-border-strong transition-colors"
          style={{ display: "block" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-overline text-text-tertiary">Estimaciones por revisar</div>
              <div className="mt-2 num-tabular" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>
                {pendientes}
              </div>
            </div>
            <Inbox size={20} strokeWidth={1.5} className="text-text-tertiary" />
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
          <Link href="/panel/estimaciones" className="btn-secondary">
            Estimaciones recibidas
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
