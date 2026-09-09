import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import EstimacionForm from "@/app/estimaciones/nueva/EstimacionForm";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getProyectosDesdeCarpetasDesarrollo } from "@/lib/clickup/client";

export const dynamic = "force-dynamic";

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

export default async function NuevaEstimacionAdminPage() {
  const [programadores, proyectosRaw] = await Promise.all([
    getProgramadores(),
    getProyectosDesdeCarpetasDesarrollo().catch(() => []),
  ]);
  const proyectos = proyectosRaw.map((p) => ({ id: p.id, nombre: p.name }));

  return (
    <>
      <Link
        href="/panel/cotizaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Volver a cotizaciones
      </Link>

      <header className="space-y-2">
        <h1 className="text-display">Crear estimación</h1>
        <p className="text-body text-text-secondary">
          Llena las tareas y horas. Se crea directo en "Revisión interna" —
          nada se manda a Slack todavía.
        </p>
      </header>

      {programadores.length === 0 ? (
        <div
          className="card"
          style={{ borderColor: "var(--state-warning)", background: "var(--bg-surface)" }}
        >
          <p className="text-body">
            <strong className="text-body-medium">Sin programadores configurados.</strong>{" "}
            <span className="text-text-secondary">Agrégalos desde Settings.</span>
          </p>
        </div>
      ) : (
        <EstimacionForm programadores={programadores} proyectos={proyectos} modoAdmin />
      )}
    </>
  );
}
