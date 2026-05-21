import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import RevisionIA from "./RevisionIA";
import EstimacionAcciones from "./EstimacionAcciones";
import MarcarRevisada from "@/components/ui/MarcarRevisada";
import type { EstimacionCruda, EstimacionLimpia } from "@/lib/anthropic/process";
import { formatFechaLarga as fmtFecha } from "@/lib/dates";

export const dynamic = "force-dynamic";

const estadoLabel: Record<string, string> = {
  recibida: "Recibida",
  procesada_ia: "Procesada con IA",
  en_revision: "Procesada con IA",
  descartada: "Descartada",
};

const estadoBadge: Record<string, string> = {
  recibida: "badge-warning",
  procesada_ia: "badge-info",
  en_revision: "badge-info",
  descartada: "badge-neutral",
};

type Estimacion = {
  id: string;
  created_at: string;
  estado: string;
  cotizacion_ref: string | null;
  datos_raw: EstimacionCruda;
  datos_limpios: EstimacionLimpia | null;
  programadores: { nombre: string; precio_hora: number } | null;
};

async function getEstimacion(id: string): Promise<Estimacion | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("estimaciones_formulario")
    .select(
      "id, created_at, estado, cotizacion_ref, datos_raw, datos_limpios, programador_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  // Lookup del programador por separado (más robusto que el embedded join)
  let programador: { nombre: string; precio_hora: number } | null = null;
  if ((data as any).programador_id) {
    const { data: p } = await supa
      .from("programadores")
      .select("nombre, precio_hora")
      .eq("id", (data as any).programador_id)
      .maybeSingle();
    if (p) programador = p as any;
  }

  return { ...(data as any), programadores: programador } as Estimacion;
}


export default async function EstimacionDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const it = await getEstimacion(params.id);
  if (!it) notFound();

  // Si ya se convirtió en cotización, vivir allá
  if (it.cotizacion_ref) {
    redirect(`/panel/cotizaciones/${it.cotizacion_ref}`);
  }

  return (
    <>
      <MarcarRevisada estimacionId={it.id} />
      <Link
        href="/panel/estimaciones"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-display">
            {it.datos_limpios?.nombre_solicitud || it.datos_raw?.nombre_solicitud || "(sin nombre)"}
          </h1>
          <span className={`badge ${estadoBadge[it.estado] ?? "badge-neutral"}`}>
            {estadoLabel[it.estado] ?? it.estado}
          </span>
        </div>
        <p className="text-caption text-text-secondary">
          {it.programadores?.nombre ?? "—"}
          {(it.datos_raw as any)?.proyecto_nombre && (
            <> · <span className="text-text-primary">{(it.datos_raw as any).proyecto_nombre}</span></>
          )}
          {" · "}{fmtFecha(it.created_at)}
        </p>
      </header>

      <EstimacionAcciones estimacionId={it.id} estado={it.estado} />

      <RevisionIA
        estimacionId={it.id}
        raw={it.datos_raw}
        limpiaInicial={it.datos_limpios}
        programador={it.programadores?.nombre ?? "—"}
        precioHora={it.programadores?.precio_hora ?? 0}
        cotizacionRef={it.cotizacion_ref}
      />

      {it.datos_raw?.notas && (
        <section className="card space-y-2">
          <h2 className="text-heading-2">Notas generales del programador</h2>
          <p className="text-body text-text-primary whitespace-pre-wrap">{it.datos_raw.notas}</p>
        </section>
      )}
    </>
  );
}
