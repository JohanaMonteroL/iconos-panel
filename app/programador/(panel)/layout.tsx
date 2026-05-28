import { redirect } from "next/navigation";
import SidebarProgramador from "@/components/ui/SidebarProgramador";
import { requireProgramador } from "@/lib/programador/auth";

export const dynamic = "force-dynamic";

export default async function PanelProgramadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const p = await requireProgramador();
  if (!p) redirect("/programador/login");
  if (p.must_change_password) redirect("/programador/cambiar-password");

  return (
    <div className="min-h-screen">
      <SidebarProgramador nombre={p.nombre} />
      <main className="md:pl-60 min-h-screen">
        <div className="container-app py-10 lg:py-12 space-y-8">{children}</div>
      </main>
    </div>
  );
}
