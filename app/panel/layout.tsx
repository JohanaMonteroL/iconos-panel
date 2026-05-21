import Sidebar from "@/components/ui/Sidebar";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import AppBadgeSync from "@/components/ui/AppBadgeSync";

export const dynamic = "force-dynamic";

async function getEstimacionesPendientes(): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  try {
    const supa = createSupabaseServiceClient();
    // "Pendientes" = estimaciones sin cotización + no archivadas + no abiertas
    // por la admin todavía. El badge baja al visitarlas (vía MarcarRevisada).
    const { count, error } = await supa
      .from("estimaciones_formulario")
      .select("id", { count: "exact", head: true })
      .is("cotizacion_ref", null)
      .is("revisada_at", null)
      .in("estado", ["recibida", "procesada_ia", "en_revision"]);
    // Fallback si la migración 0006 aún no se aplicó (columna inexistente).
    if (error && /revisada_at|column/i.test(error.message)) {
      const { count: c2 } = await supa
        .from("estimaciones_formulario")
        .select("id", { count: "exact", head: true })
        .is("cotizacion_ref", null)
        .in("estado", ["recibida", "procesada_ia", "en_revision"]);
      return c2 ?? 0;
    }
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const estimacionesPendientes = await getEstimacionesPendientes();

  return (
    <div className="min-h-screen">
      <Sidebar badges={{ estimaciones: estimacionesPendientes }} />
      <AppBadgeSync count={estimacionesPendientes} />
      <main className="md:pl-60 min-h-screen">
        <div className="container-app py-10 lg:py-12 space-y-8">{children}</div>
      </main>
    </div>
  );
}
