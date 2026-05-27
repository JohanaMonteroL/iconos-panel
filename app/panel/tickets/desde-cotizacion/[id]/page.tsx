import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import GridDesdeCotizacion from "./GridDesdeCotizacion";

export const dynamic = "force-dynamic";

export default function DesdeCotizacionPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <Link
        href={`/panel/cotizaciones/${params.id}`}
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver a la cotización
      </Link>

      <header className="space-y-2">
        <h1 className="text-display">Generar tickets por tarea</h1>
        <p className="text-body text-text-secondary">
          Un ticket en JIRA por cada tarea de la cotización. Ajusta lo que
          falte (asignado, proyecto, prioridad) y se crean todos juntos.
        </p>
      </header>

      <GridDesdeCotizacion cotizacionId={params.id} />
    </>
  );
}
