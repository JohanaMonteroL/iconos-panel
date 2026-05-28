import Link from "next/link";
import { Clock, FileCheck, User } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import VistaToggle from "@/components/ui/VistaToggle";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta } from "@/lib/dates";
import { labelEstado, badgeEstado } from "@/lib/estados";
import FiltrosEstimaciones from "./FiltrosEstimaciones";

type Vista = "lista" | "cuadricula";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_at: string;
  estado: string;
  programador_id: string | null;
  datos_raw: {
    nombre_solicitud?: string;
    notas?: string | null;
    proyecto_nombre?: string | null;
    tareas?: Array<{ hrs_min: number; hrs_max: number }>;
  };
  programadores: { nombre: string } | null;
};

type Filtros = {
  archivadas: boolean;
  q: string | null;
  estado: string | null;
  programador: string | null;
  proyecto: string | null;
  desde: string | null;
  hasta: string | null;
};

async function getEstimaciones(filtros: Filtros): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();

  const estadosActivos = ["recibida", "procesada_ia", "en_revision"];
  let q = supa
    .from("estimaciones_formulario")
    .select("id, created_at, estado, datos_raw, programador_id")
    .is("cotizacion_ref", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (filtros.archivadas) {
    q = q.eq("estado", "descartada");
  } else if (filtros.estado) {
    q = q.eq("estado", filtros.estado);
  } else {
    q = q.in("estado", estadosActivos);
  }

  if (filtros.programador) q = q.eq("programador_id", filtros.programador);
  if (filtros.desde) q = q.gte("created_at", `${filtros.desde}T00:00:00`);
  if (filtros.hasta) q = q.lte("created_at", `${filtros.hasta}T23:59:59`);
  if (filtros.q) {
    q = q.ilike("datos_raw->>nombre_solicitud", `%${filtros.q}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[estimaciones] error:", error);
    return [];
  }
  if (!data || data.length === 0) return [];

  // Proyecto se filtra en memoria (vive en datos_raw json).
  let filtradas = data as any[];
  if (filtros.proyecto) {
    filtradas = filtradas.filter(
      (r) => r.datos_raw?.proyecto_nombre === filtros.proyecto
    );
  }

  const ids = Array.from(
    new Set(filtradas.map((r: any) => r.programador_id).filter(Boolean))
  );
  let progMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: progs } = await supa
      .from("programadores")
      .select("id, nombre")
      .in("id", ids);
    progMap = new Map((progs ?? []).map((p: any) => [p.id, p.nombre]));
  }

  return filtradas.map((r: any) => ({
    ...r,
    programadores: r.programador_id
      ? { nombre: progMap.get(r.programador_id) ?? "—" }
      : null,
  })) as Row[];
}

async function getProgramadores(): Promise<{ id: string; nombre: string }[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("programadores")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  return (data ?? []) as any[];
}

async function getProyectosDeEstimaciones(): Promise<string[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const { data } = await supa
    .from("estimaciones_formulario")
    .select("datos_raw")
    .limit(2000);
  if (!data) return [];
  const set = new Set<string>();
  for (const r of data as any[]) {
    const p = r.datos_raw?.proyecto_nombre;
    if (p) set.add(p);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}

function totalHoras(
  tareas?: Row["datos_raw"]["tareas"]
): { min: number; max: number } {
  if (!tareas) return { min: 0, max: 0 };
  return tareas.reduce(
    (acc, t) => ({
      min: acc.min + (t.hrs_min || 0),
      max: acc.max + (t.hrs_max || 0),
    }),
    { min: 0, max: 0 }
  );
}

export default async function EstimacionesPage({
  searchParams,
}: {
  searchParams: {
    archivadas?: string;
    q?: string;
    estado?: string;
    programador?: string;
    proyecto?: string;
    desde?: string;
    hasta?: string;
    vista?: string;
  };
}) {
  const vistaExplicita: Vista | null =
    searchParams.vista === "cuadricula"
      ? "cuadricula"
      : searchParams.vista === "lista"
      ? "lista"
      : null;
  const vista: Vista = vistaExplicita ?? "lista";
  const filtros: Filtros = {
    archivadas: searchParams.archivadas === "1",
    q: searchParams.q ?? null,
    estado: searchParams.estado ?? null,
    programador: searchParams.programador ?? null,
    proyecto: searchParams.proyecto ?? null,
    desde: searchParams.desde ?? null,
    hasta: searchParams.hasta ?? null,
  };

  const [items, programadores, proyectos] = await Promise.all([
    getEstimaciones(filtros),
    getProgramadores(),
    getProyectosDeEstimaciones(),
  ]);

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-display">Estimaciones recibidas</h1>
          <p className="text-body text-text-secondary">
            {filtros.archivadas
              ? "Estimaciones archivadas."
              : "Enviadas por los programadores."}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <VistaToggle vista={vista} />
          <AutoRefresh intervalSeconds={10} />
        </div>
      </header>

      <div
        className="inline-flex gap-1 p-1 rounded-lg"
        style={{ background: "var(--bg-overlay)" }}
      >
        <Link
          href="/panel/estimaciones"
          className={`btn-sm ${!filtros.archivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Activas
        </Link>
        <Link
          href="/panel/estimaciones?archivadas=1"
          className={`btn-sm ${filtros.archivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Archivadas
        </Link>
      </div>

      <FiltrosEstimaciones
        programadores={programadores}
        proyectos={proyectos}
        actuales={filtros}
      />

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin estimaciones que coincidan con los filtros.
        </div>
      ) : vistaExplicita ? (
        vistaExplicita === "cuadricula" ? (
          <CuadriculaEstimaciones items={items} />
        ) : (
          <ListaEstimaciones items={items} />
        )
      ) : (
        <>
          <div className="md:hidden">
            <CuadriculaEstimaciones items={items} />
          </div>
          <div className="hidden md:block">
            <ListaEstimaciones items={items} />
          </div>
        </>
      )}
    </>
  );
}

function ListaEstimaciones({ items }: { items: Row[] }) {
  return (
    <ul
      className="rounded-[12px] overflow-hidden border"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <li
        className="hidden md:grid md:grid-cols-[1fr_160px_160px_120px_110px_36px] gap-3 px-5 py-2 text-overline text-text-tertiary"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div>Nombre</div>
        <div>Programador</div>
        <div>Proyecto</div>
        <div>Estado</div>
        <div>Fecha</div>
        <div />
      </li>
      {items.map((it, i) => {
        const t = totalHoras(it.datos_raw?.tareas);
        const nTareas = it.datos_raw?.tareas?.length ?? 0;
        return (
          <li
            key={it.id}
            style={{
              borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
            }}
          >
            <Link
              href={`/panel/estimaciones/${it.id}`}
              className="block hover:bg-[color:var(--bg-surface)] transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_120px_110px_36px] gap-3 px-5 py-3 items-center">
                <div className="min-w-0">
                  <div className="text-body-medium text-text-primary break-words">
                    {it.datos_raw?.nombre_solicitud || "(sin nombre)"}
                  </div>
                  <div className="text-caption text-text-tertiary flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <FileCheck size={11} strokeWidth={1.5} />
                      {nTareas} tarea{nTareas === 1 ? "" : "s"}
                    </span>
                    <span className="num-tabular inline-flex items-center gap-1">
                      <Clock size={11} strokeWidth={1.5} />
                      {t.min}–{t.max}h
                    </span>
                    <span className="md:hidden">
                      {it.programadores?.nombre ?? "—"}
                    </span>
                    {it.datos_raw?.proyecto_nombre && (
                      <span className="md:hidden">
                        {it.datos_raw.proyecto_nombre}
                      </span>
                    )}
                    <span className="md:hidden">
                      {formatFechaCorta(it.created_at)}
                    </span>
                  </div>
                </div>

                <div className="hidden md:block text-caption text-text-secondary break-words">
                  {it.programadores?.nombre ?? "—"}
                </div>

                <div className="hidden md:block text-caption text-text-secondary break-words">
                  {it.datos_raw?.proyecto_nombre ?? "—"}
                </div>

                <div className="flex md:block">
                  <span className={`badge ${badgeEstado(it.estado)}`}>
                    {labelEstado(it.estado)}
                  </span>
                </div>

                <div className="hidden md:block text-caption text-text-tertiary num-tabular">
                  {formatFechaCorta(it.created_at)}
                </div>

                <div className="hidden md:flex justify-end text-text-tertiary">
                  ›
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CuadriculaEstimaciones({ items }: { items: Row[] }) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((it) => {
        const t = totalHoras(it.datos_raw?.tareas);
        const nTareas = it.datos_raw?.tareas?.length ?? 0;
        return (
          <li key={it.id}>
            <Link
              href={`/panel/estimaciones/${it.id}`}
              className="card hover:border-border-strong transition-colors space-y-3 block"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-body-medium text-text-primary break-words flex-1 min-w-0">
                  {it.datos_raw?.nombre_solicitud || "(sin nombre)"}
                </h2>
                <span className={`badge ${badgeEstado(it.estado)} shrink-0`}>
                  {labelEstado(it.estado)}
                </span>
              </div>
              <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <User size={12} strokeWidth={1.5} />
                  {it.programadores?.nombre ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileCheck size={12} strokeWidth={1.5} />
                  {nTareas} tarea{nTareas === 1 ? "" : "s"}
                </span>
                <span className="num-tabular inline-flex items-center gap-1.5">
                  <Clock size={12} strokeWidth={1.5} />
                  {t.min}–{t.max} h
                </span>
              </div>
              {it.datos_raw?.proyecto_nombre && (
                <p className="text-caption text-text-tertiary">
                  {it.datos_raw.proyecto_nombre}
                </p>
              )}
              <p className="text-caption text-text-tertiary num-tabular">
                {formatFechaCorta(it.created_at)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
