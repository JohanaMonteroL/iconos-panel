import Link from "next/link";
import { Clock, User, ExternalLink } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formatFechaCorta as fmtFecha } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nombre: string;
  estado: string;
  horas_min: number;
  horas_max: number;
  created_at: string;
  clickup_ticket_id: string | null;
  programadores: { nombre: string } | null;
};

const estadosVisibles = [
  "pendiente_revisar",
  "esperando_aprobacion",
  "aprobada",
  "cambios_solicitados",
  "en_desarrollo",
  "enviada_cliente",
];

async function getCotizaciones(incluirArchivadas: boolean): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  let q = supa
    .from("cotizaciones")
    .select(
      "id, nombre, estado, horas_min, horas_max, created_at, clickup_ticket_id, programadores(nombre)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (!incluirArchivadas) q = q.in("estado", estadosVisibles);
  const { data, error } = await q;
  if (error) {
    console.error("[cotizaciones] error:", error);
    return [];
  }
  return (data ?? []) as unknown as Row[];
}

const badgeFor: Record<string, string> = {
  pendiente_revisar: "badge-warning",
  esperando_aprobacion: "badge-info",
  aprobada: "badge-success",
  cambios_solicitados: "badge-danger",
  en_desarrollo: "badge-info",
  enviada_cliente: "badge-success",
  archivada: "badge-neutral",
};

const estadoLabel: Record<string, string> = {
  pendiente_revisar: "Por revisar",
  esperando_aprobacion: "Esperando jefe",
  aprobada: "Aprobada",
  cambios_solicitados: "Pidieron cambios",
  en_desarrollo: "En desarrollo",
  enviada_cliente: "Enviada al cliente",
  archivada: "Archivada",
};


export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: { archivadas?: string };
}) {
  const incluirArchivadas = searchParams.archivadas === "1";
  const items = await getCotizaciones(incluirArchivadas);

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-display">Cotizaciones</h1>
          <p className="text-body text-text-secondary">
            {incluirArchivadas ? "Mostrando todas (incluye archivadas)" : "Activas únicamente"}
          </p>
        </div>
        <AutoRefresh intervalSeconds={15} />
      </header>

      <div className="inline-flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-overlay)" }}>
        <Link
          href="/panel/cotizaciones"
          className={`btn-sm ${!incluirArchivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Activas
        </Link>
        <Link
          href="/panel/cotizaciones?archivadas=1"
          className={`btn-sm ${incluirArchivadas ? "btn-primary" : "btn-ghost"}`}
        >
          Historial
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          {incluirArchivadas
            ? "Sin cotizaciones todavía."
            : "Sin cotizaciones activas. Crea una desde una estimación recibida."}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/panel/cotizaciones/${it.id}`}
                className="card hover:border-border-strong transition-colors space-y-3 block"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-body-medium text-text-primary line-clamp-2">{it.nombre}</h2>
                  <span className={`badge ${badgeFor[it.estado] ?? "badge-neutral"}`}>
                    {estadoLabel[it.estado] ?? it.estado}
                  </span>
                </div>
                <div className="text-caption text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <User size={12} strokeWidth={1.5} />
                    {it.programadores?.nombre ?? "—"}
                  </span>
                  <span className="num-tabular inline-flex items-center gap-1.5">
                    <Clock size={12} strokeWidth={1.5} />
                    {it.horas_min}–{it.horas_max} h
                  </span>
                  {it.clickup_ticket_id && (
                    <span className="inline-flex items-center gap-1.5">
                      <ExternalLink size={12} strokeWidth={1.5} />
                      ClickUp
                    </span>
                  )}
                </div>
                <p className="text-caption text-text-tertiary">{fmtFecha(it.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
