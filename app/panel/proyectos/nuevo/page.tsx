import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import NuevoProyectoForm from "./NuevoProyectoForm";

export const dynamic = "force-dynamic";

export default function NuevoProyectoPage() {
  return (
    <>
      <Link
        href="/panel/proyectos"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver a proyectos
      </Link>

      <NuevoProyectoForm />
    </>
  );
}
