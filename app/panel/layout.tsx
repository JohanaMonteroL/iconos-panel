import Sidebar from "@/components/ui/Sidebar";
import PanelHeader from "@/components/ui/PanelHeader";
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
      <main
        className="min-h-screen md:pl-[var(--sidebar-w,240px)]"
        style={{ transition: "padding-left 260ms cubic-bezier(.4,0,.2,1)" }}
      >
        <PanelHeader badgeCount={estimacionesPendientes} />
        <div className="container-panel py-8 lg:py-10 space-y-8">{children}</div>
      </main>
    </div>
  );
}
