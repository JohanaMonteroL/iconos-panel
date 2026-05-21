import Link from "next/link";
import { Clock, User, FileCheck } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_at: string;
  estado: string;
  datos_raw: {
    nombre_solicitud?: string;
    notas?: string | null;
    tareas?: Array<{ hrs_min: number; hrs_max: number }>;
  };
  programadores: { nombre: string } | null;
};

async function getEstimaciones(archivadas: boolean): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  // Query principal SIN embedded join (más robusto), después juntamos
  // los nombres de programadores manualmente.
  // Lista explícita de estados válidos en cada pestaña — evita que un registro
  // con estado inesperado se cuele en el lugar equivocado.
  const estadosActivos = ["recibida", "procesada_ia", "en_revision"];
  let q = supa
    .from("estimaciones_formulario")
    .select("id, created_at, estado, datos_raw, programador_id")
    .is("cotizacion_ref", null)
    .order("created_at", { ascending: false })
    .limit(200);
  q = archivadas ? q.eq("estado", "descartada") : q.in("estado", estadosActivos);
  const { data, error } = await q;
  if (error) {
    console.error("[estimaciones] error:", error);
    return [];
  }
  if (!data || data.length === 0) return [];

  // Resolver nombres de programadores en una sola query
  const ids = Array.from(
    new Set(data.map((r: any) => r.programador_id).filter(Boolean))
  );
  let progMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: progs } = await supa
      .from("programadores")
      .select("id, nombre")
      .in("id", ids);
    progMap = new Map((progs ?? []).map((p: any) => [p.id, p.nombre]));
  }

  return data.map((r: any) => ({
    ...r,
    programadores: r.programador_id
      ? { nombre: progMap.get(r.programador_id) ?? "—" }
      : null,
  })) as Row[];
}

const fmtFecha = formatFechaCorta;

function totalHoras(tareas?: Row["datos_raw"]["tareas"]): { min: number; max: number } {
  if (!tareas) return { min: 0, max: 0 };
  return tareas.reduce(
    (acc, t) => ({ min: acc.min + (t.hrs_min || 0), max: acc.max + (t.hrs_max || 0) }),
    { min: 0, max: 0 }
  );
}

const badgeClass: Record<string, string> = {
  recibida: "badge-warning",
  procesada_ia: "badge-info",
  en_revision: "badge-info", // legacy, mismo significado
  descartada: "badge-neutral",
};

const estadoLabel: Record<string, string> = {
  recibida: "Recibida",
  procesada_ia: "Procesada con IA",
  en_revision: "Procesada con IA", // legacy
  descartada: "Descartada",
};

export default async function EstimacionesPage({
  searchParams,
}: {
  searchParams: { archivadas?: string };
}) {
  const archivadas = searchParams.archivadas === "1";
  const items = await getEstimaciones(archivadas);

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-display">Estimaciones recibidas</h1>
          <p className="text-body text-text-secondary">
            {archivadas
              ? "Estimaciones archivadas."
              : "Enviadas por los programadores desde el formulario público."}
          </p>
        </div>
        <AutoRefresh intervalSeconds={10} />
      </header>

      <div
        className="inline-flex gap-1 p-1 rounded-lg"
        style={{ background: "var(--bg-overlay)" }}
      >
        <Link
          href="/panel/estimaciones"
          className={`btn-sm ${!archivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Activas
        </Link>
        <Link
          href="/panel/estimaciones?archivadas=1"
          className={`btn-sm ${archivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Archivadas
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Todavía no hay estimaciones recibidas.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it) => {
            const t = totalHoras(it.datos_raw?.tareas);
            const cantidadTareas = it.datos_raw?.tareas?.length ?? 0;
            return (
              <li key={it.id}>
                <Link
                  href={`/panel/estimaciones/${it.id}`}
                  className="card hover:border-border-strong transition-colors space-y-3 block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-body-medium text-text-primary line-clamp-2 min-w-0 flex-1">
                      {it.datos_raw?.nombre_solicitud || "(sin nombre)"}
                    </h2>
                    <span className={`badge ${badgeClass[it.estado] ?? "badge-neutral"}`}>
                      {estadoLabel[it.estado] ?? it.estado.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <User size={12} strokeWidth={1.5} />
                      {it.programadores?.nombre ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileCheck size={12} strokeWidth={1.5} />
                      {cantidadTareas} tarea{cantidadTareas === 1 ? "" : "s"}
                    </span>
                    <span className="num-tabular inline-flex items-center gap-1.5">
                      <Clock size={12} strokeWidth={1.5} />
                      {t.min}–{t.max} h
                    </span>
                  </div>
                  <p className="text-caption text-text-tertiary">{fmtFecha(it.created_at)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
