import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

export default function PasswordPage({
  searchParams,
}: {
  searchParams?: { forzado?: string };
}) {
  const forzado = searchParams?.forzado === "1";

  return (
    <>
      {!forzado && (
        <Link
          href="/panel/settings"
          className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Settings
        </Link>
      )}

      <header className="space-y-2">
        <h1 className="text-display">Cambiar contraseña</h1>
        <p className="text-body text-text-secondary">
          {forzado
            ? "Tu contraseña es temporal. Elige una nueva para poder usar el panel."
            : "La contraseña nueva se guarda en la base de datos y reemplaza la del archivo de configuración. No tienes que tocar Vercel."}
        </p>
      </header>

      <PasswordForm forzado={forzado} />
    </>
  );
}
