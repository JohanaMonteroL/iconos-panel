import Sidebar from "@/components/ui/Sidebar";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="md:pl-60 min-h-screen">
        <div className="container-app py-10 lg:py-12 space-y-8">{children}</div>
      </main>
    </div>
  );
}
