import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import AdministradorRow, { type Administrador } from "./AdministradorRow";
import NuevoAdministradorForm from "./NuevoAdministradorForm";

export const dynamic = "force-dynamic";

async function getAdministradores(): Promise<Administrador[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("administradores")
    .select("id, nombre, correo, must_change_password, activo")
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true });
  if (error) return [];
  return (data ?? []) as Administrador[];
}

export default async function AdministradoresPage() {
  const items = await getAdministradores();
  const activos = items.filter((a) => a.activo);
  const inactivos = items.filter((a) => !a.activo);

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
        <h1 className="text-display">Administradores</h1>
        <p className="text-body text-text-secondary">
          Otras personas con acceso completo al panel. Tú generas la contraseña
          temporal y ellos la cambian en su primer login.
        </p>
      </header>

      <NuevoAdministradorForm />

      <section className="space-y-3">
        <h2 className="text-heading-2">Activos ({activos.length})</h2>
        {activos.length === 0 ? (
          <p className="text-body text-text-secondary">Ningún administrador adicional todavía.</p>
        ) : (
          <ul className="space-y-2">
            {activos.map((a) => (
              <AdministradorRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      {inactivos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-heading-2">Inactivos ({inactivos.length})</h2>
          <ul className="space-y-2">
            {inactivos.map((a) => (
              <AdministradorRow key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
