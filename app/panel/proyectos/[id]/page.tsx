import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { DatosGeneralesCard, NotasCard, EstadoCard, type ProyectoData } from "./FichaProyecto";
import ContactosFacturacion, { type ContactoFacturacion } from "./ContactosFacturacion";

export const dynamic = "force-dynamic";

async function getProyecto(id: string): Promise<ProyectoData | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("proyectos")
    .select("id, nombre, contacto_principal, rfc, correo, telefono, precio_hora_venta, moneda_hora, color, notas, activo")
    .eq("id", id)
    .maybeSingle();
  return (data as ProyectoData) ?? null;
}

async function getContactosFacturacion(proyectoId: string): Promise<ContactoFacturacion[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("proyectos_contactos_facturacion")
    .select("id, correo, nombre")
    .eq("proyecto_id", proyectoId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[proyectos] error cargando contactos de facturación:", error);
    return [];
  }
  return (data ?? []) as ContactoFacturacion[];
}

export default async function ProyectoDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const [proyecto, contactosFacturacion] = await Promise.all([
    getProyecto(params.id),
    getContactosFacturacion(params.id),
  ]);
  if (!proyecto) notFound();

  return (
    <>
      <Link
        href="/panel/proyectos"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver a proyectos
      </Link>

      <header className="flex items-center gap-3 flex-wrap">
        <span
          style={{ width: 14, height: 14, borderRadius: "50%", background: proyecto.color, flexShrink: 0 }}
        />
        <h1 className="text-display">{proyecto.nombre}</h1>
        <span className={`badge ${proyecto.activo ? "badge-success" : "badge-neutral"}`}>
          {proyecto.activo ? "Activo" : "Inactivo"}
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <DatosGeneralesCard proyecto={proyecto} />
        <div className="space-y-4 lg:col-start-2">
          <ContactosFacturacion proyectoId={proyecto.id} contactosIniciales={contactosFacturacion} />
          <NotasCard proyecto={proyecto} />
        </div>
      </div>

      <EstadoCard proyecto={proyecto} />
    </>
  );
}
