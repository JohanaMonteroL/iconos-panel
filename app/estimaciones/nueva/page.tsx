import EstimacionForm from "./EstimacionForm";
import PublicHeader from "@/components/ui/PublicHeader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProyectoOptions } from "@/lib/clickup/client";

export const dynamic = "force-dynamic";

async function getProgramadores(): Promise<{ id: string; nombre: string }[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    const supa = createSupabaseServerClient();
    const { data, error } = await supa
      .from("programadores")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre");
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function NuevaEstimacionPage() {
  const [programadores, proyectos] = await Promise.all([
    getProgramadores(),
    getProyectoOptions(),
  ]);

  return (
    <>
      <PublicHeader />
      <main style={{ background: "var(--bg-surface)" }} className="min-h-[calc(100vh-56px)]">
        <div className="container-app py-10 lg:py-12 space-y-8">
          <header className="space-y-2">
            <h1 className="text-display">Nueva estimación</h1>
            <p className="text-body text-text-secondary">
              Llena tu estimación. Johana la revisa antes de crear la cotización.
            </p>
          </header>

          {programadores.length === 0 ? (
            <div
              className="card"
              style={{
                borderColor: "var(--state-warning)",
                background: "var(--bg-surface)",
              }}
            >
              <p className="text-body">
                <strong className="text-body-medium">Sin programadores configurados.</strong>{" "}
                <span className="text-text-secondary">
                  Pide a Johana que los agregue desde Settings.
                </span>
              </p>
            </div>
          ) : (
            <EstimacionForm
              programadores={programadores}
              proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.name }))}
            />
          )}
        </div>
      </main>
    </>
  );
}
