import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getProyectoOptions } from "@/lib/clickup/client";
import NuevaCotizacionFijaForm from "./NuevaCotizacionFijaForm";

export const dynamic = "force-dynamic";

async function getProgramadores(): Promise<{ id: string; nombre: string }[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const supa = createSupabaseServiceClient();
    const { data } = await supa
      .from("programadores")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre");
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function NuevaCotizacionPage() {
  const [programadores, proyectosRaw] = await Promise.all([
    getProgramadores(),
    getProyectoOptions().catch(() => []),
  ]);
  const proyectos = proyectosRaw.map((p) => ({ id: p.id, nombre: p.name }));

  return (
    <>
      <Link
        href="/panel/cotizaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver a cotizaciones
      </Link>

      <header className="space-y-2">
        <h1 className="text-display">Cotización rápida</h1>
        <p className="text-body text-text-secondary">
          Para ventas o servicios con monto fijo (ej. venta de un dispositivo).
          Sin horas ni tareas. Se crea el ticket en ClickUp y se manda al jefe
          para aprobación automáticamente.
        </p>
      </header>

      <NuevaCotizacionFijaForm
        programadores={programadores}
        proyectos={proyectos}
      />
    </>
  );
}
