import { redirect } from "next/navigation";
import { requireProgramador } from "@/lib/programador/auth";
import CambiarPasswordForm from "./CambiarPasswordForm";

export const dynamic = "force-dynamic";

export default async function CambiarPasswordPage() {
  const p = await requireProgramador();
  if (!p) redirect("/programador/login");

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-display">Cambiar contraseña</h1>
          <p className="text-body text-text-secondary">
            {p.must_change_password
              ? "Tu contraseña es temporal. Elige una nueva para continuar."
              : "Actualiza tu contraseña."}
          </p>
        </header>
        <CambiarPasswordForm obligatorio={p.must_change_password} />
      </div>
    </main>
  );
}
