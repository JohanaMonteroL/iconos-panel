import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProgramador } from "@/lib/programador/auth";
import { getProyectoOptions } from "@/lib/clickup/client";
import EstimacionForm from "@/app/estimaciones/nueva/EstimacionForm";

export const dynamic = "force-dynamic";

export default async function NuevaEstimacionProgramadorPage() {
  const p = (await requireProgramador())!;
  const proyectosRaw = await getProyectoOptions().catch(() => []);
  const proyectos = proyectosRaw.map((px) => ({ id: px.id, nombre: px.name }));

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
