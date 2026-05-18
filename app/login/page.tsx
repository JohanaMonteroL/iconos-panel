import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import PublicHeader from "@/components/ui/PublicHeader";
import { getSessionFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  let already = false;
  try {
    already = getSessionFromCookies().ok;
  } catch {}
  if (already) redirect("/panel");

  return (
    <>
      <PublicHeader />
      <main
        className="min-h-[calc(100vh-56px)] flex items-center"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="container-form py-12 space-y-6">
          <header className="space-y-2 text-center">
            <h1 className="text-display">Acceso al panel</h1>
            <p className="text-caption text-text-secondary">Solo para Johana</p>
          </header>
          <div className="card">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}
