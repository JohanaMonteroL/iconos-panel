import { redirect } from "next/navigation";
import { requireProgramador } from "@/lib/programador/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function ProgramadorLoginPage() {
  // Si ya hay sesión válida, redirige al dashboard
  const p = await requireProgramador();
  if (p) {
    if (p.must_change_password) redirect("/programador/cambiar-password");
    redirect("/programador");
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-display">ICONOS</h1>
          <p className="text-body text-text-secondary">
            Portal de programadores
          </p>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
