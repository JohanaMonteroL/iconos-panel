import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProgramador } from "@/lib/programador/auth";
import { getProyectosActivos } from "@/lib/proyectos/catalogo";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import EstimacionForm from "@/app/estimaciones/nueva/EstimacionForm";

export const dynamic = "force-dynamic";

export default async function NuevaEstimacionProgramadorPage() {
  const p = (await requireProgramador())!;
  const proyectos = await getProyectosActivos(createSupabaseServiceClient());

  return (
    <>
      <Link
        href="/programador/estimaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver a mis estimaciones
      </Link>

      <header className="space-y-2">
        <h1 className="text-display">Nueva estimación</h1>
        <p className="text-body text-text-secondary">
          Llena las tareas y sus horas. Johana revisa antes de cotizar.
        </p>
      </header>

      <EstimacionForm
        programadores={[{ id: p.id, nombre: p.nombre }]}
        proyectos={proyectos}
      />
    </>
  );
}
