import Link from "next/link";
import { Home, FileText } from "lucide-react";
import PublicHeader from "@/components/ui/PublicHeader";

export default function NotFound() {
  return (
    <>
      <PublicHeader showHome={false} />
      <main
        className="min-h-[calc(100vh-56px)] flex items-center"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="container-form py-12 space-y-8 text-center">
          <div className="space-y-3">
            <div className="text-display">404</div>
            <h1 className="text-heading-1">Página no encontrada</h1>
            <p className="text-body text-text-secondary">
              La URL que escribiste no existe. ¿Qué quieres hacer?
            </p>
          </div>

          <div className="card space-y-3">
            <Link href="/" className="btn-secondary w-full">
              <Home size={16} strokeWidth={1.75} />
              <span>Volver al inicio</span>
            </Link>
            <Link href="/estimaciones/nueva" className="btn-primary w-full">
              <FileText size={16} strokeWidth={1.75} />
              <span>Enviar una estimación</span>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
