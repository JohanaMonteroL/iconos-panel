import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
            <Link href="/login" className="btn-primary w-full">
              <span>Entrar al panel</span>
              <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
            <Link href="/estimaciones/nueva" className="btn-secondary w-full">
              Enviar estimación (programadores)
            </Link>
          </div>

          <p className="text-caption text-text-tertiary text-center">
            Fase 1 — Núcleo de cotizaciones
          </p>
        </div>
      </main>
    </>
  );
}
