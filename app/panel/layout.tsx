import Sidebar from "@/components/ui/Sidebar";
import PanelHeader from "@/components/ui/PanelHeader";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import AppBadgeSync from "@/components/ui/AppBadgeSync";
import { ESTADOS_ESTIMACION_ACTIVA } from "@/lib/estados";

export const dynamic = "force-dynamic";

async function getEstimacionesPendientes(): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  try {
    const supa = createSupabaseServiceClient();
    // "Pendientes" = cotizaciones en etapa temprana (por_estimar /
    // pendiente_revision_interna) que Johana no ha abierto todavía. El
    // badge baja al visitarlas (vía MarcarRevisada, ahora sobre cotizaciones).
    const { count, error } = await supa
      .from("cotizaciones")
      .select("id", { count: "exact", head: true })
      .is("revisada_at", null)
      .in("estado", ESTADOS_ESTIMACION_ACTIVA);
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
      <Sidebar />
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
