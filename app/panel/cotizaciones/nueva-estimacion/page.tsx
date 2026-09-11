import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import EstimacionForm from "@/app/estimaciones/nueva/EstimacionForm";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getProgramadores(): Promise<
  { id: string; nombre: string; precio_hora: number }[]
> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const supa = createSupabaseServiceClient();
    const { data, error } = await supa
      .from("programadores")
      .select("id, nombre, precio_hora")
      .eq("activo", true)
      .order("nombre");
    if (error) return [];
    return (data ?? []).map((p) => ({ ...p, precio_hora: p.precio_hora ?? 0 }));
  } catch {
    return [];
  }
}

// Proyectos activos del catálogo (no ClickUp) — trae también el costo por
// hora configurado en el proyecto, para el cálculo de "Costo estimado".
async function getProyectos(): Promise<
  { id: string; nombre: string; precio_hora_venta: number; moneda_hora: "MXN" | "USD"; emoji?: string }[]
> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const supa = createSupabaseServiceClient();
    let { data, error }: { data: any; error: any } = await supa
      .from("proyectos")
      .select("id, nombre, precio_hora_venta, moneda_hora, emoji")
      .eq("activo", true)
      .order("nombre");
    if (error && /emoji/i.test(error.message)) {
      ({ data, error } = await supa
        .from("proyectos")
        .select("id, nombre, precio_hora_venta, moneda_hora")
        .eq("activo", true)
        .order("nombre"));
    }
    if (error) return [];
    return (data ?? []) as any[];
  } catch {
    return [];
  }
}

export default async function NuevaEstimacionAdminPage() {
  const [programadores, proyectos] = await Promise.all([
    getProgramadores(),
    getProyectos(),
  ]);

  return (
    <>
      <Link
        href="/panel/cotizaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Volver a cotizaciones
      </Link>

      {programadores.length === 0 ? (
        <div
          className="card"
          style={{ borderColor: "var(--state-warning)", background: "var(--bg-surface)" }}
        >
          <p className="text-body">
            <strong className="text-body-medium">Sin programadores configurados.</strong>{" "}
            <span className="text-text-secondary">Agrégalos desde Settings.</span>
          </p>
        </div>
      ) : (
        <EstimacionForm programadores={programadores} proyectos={proyectos} modoAdmin />
      )}
    </>
  );
}
