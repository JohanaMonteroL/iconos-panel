import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import ProgramadorRow, { type Programador } from "./ProgramadorRow";
import NuevoProgramadorForm from "./NuevoProgramadorForm";

export const dynamic = "force-dynamic";

async function getProgramadores(): Promise<Programador[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("programadores")
    .select("id, nombre, slack_id, precio_hora, activo")
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export default async function ProgramadoresPage() {
  const items = await getProgramadores();
  const activos = items.filter((p) => p.activo);
  const inactivos = items.filter((p) => !p.activo);

  return (
    <>
      <Link
        href="/panel/settings"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Settings
      </Link>

      <header className="space-y-2">
        <h1 className="text-display">Programadores</h1>
        <p className="text-body text-text-secondary">
          Gestiona el listado de programadores que aparece en el formulario público de
          estimaciones, y sus precios por hora internos.
        </p>
      </header>

      <NuevoProgramadorForm />

      <section className="space-y-3">
        <h2 className="text-heading-2">Activos ({activos.length})</h2>
        {activos.length === 0 ? (
          <p className="text-body text-text-secondary">Ningún programador activo.</p>
        ) : (
          <ul className="space-y-2">
            {activos.map((p) => (
              <ProgramadorRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      {inactivos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-heading-2">Inactivos ({inactivos.length})</h2>
          <ul className="space-y-2">
            {inactivos.map((p) => (
              <ProgramadorRow key={p.id} p={p} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
