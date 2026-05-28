import Link from "next/link";
import { ArrowRight, ShieldCheck, Code, FilePlus } from "lucide-react";
import PublicHeader from "@/components/ui/PublicHeader";

export default function Home() {
  return (
    <>
      <PublicHeader showHome={false} />
      <main
        className="min-h-[calc(100vh-56px)] flex items-center"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="container-form py-12 space-y-8">
          <header className="space-y-2">
            <h1 className="text-display">ICONOS Panel</h1>
            <p className="text-body text-text-secondary">
              Panel interno de cotizaciones y desarrollo.
            </p>
          </header>

          <div className="card space-y-3">
            <Link
              href="/login"
              className="btn-primary w-full text-body-medium"
              style={{ padding: "22px 20px", gap: 12 }}
            >
              <ShieldCheck size={20} strokeWidth={1.75} />
              <span className="flex-1 text-left">Inicio de administrador</span>
              <ArrowRight size={18} strokeWidth={1.75} />
            </Link>
            <Link
              href="/programador/login"
              className="btn-secondary w-full text-body-medium"
              style={{ padding: "22px 20px", gap: 12 }}
            >
              <Code size={20} strokeWidth={1.75} />
              <span className="flex-1 text-left">Inicio de programador</span>
              <ArrowRight size={18} strokeWidth={1.75} />
            </Link>
            <Link
              href="/estimaciones/nueva"
              className="btn-ghost w-full text-body-medium"
              style={{ padding: "22px 20px", gap: 12 }}
            >
              <FilePlus size={20} strokeWidth={1.75} />
              <span className="flex-1 text-left">Crear estimación</span>
              <ArrowRight size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
