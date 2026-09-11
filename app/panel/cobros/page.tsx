import { AlertTriangle } from "lucide-react";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ORDEN_FLUJO_COBRO_PERIODO } from "@/lib/estados/cobros";
import { rangoRapidoAFechas } from "@/lib/dates";
import TableroCobros from "./TableroCobros";
import FiltrosCobros from "./FiltrosCobros";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  estado: string;
  etiqueta: string;
  monto: number;
  moneda: string;
  created_at: string;
  cobro_id: string;
  origen: string;
  titulo: string;
  proyecto_id: string | null;
  cotizacion_id: string | null;
  factura_pdf_path: string | null;
  factura_xml_path: string | null;
};

function relationMissing(message: string | undefined | null): boolean {
  if (!message) return false;
  return /relation .* does not exist/i.test(message);
}

async function getPeriodos(): Promise<{ items: Row[]; migracionPendiente: boolean }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { items: [], migracionPendiente: false };
  const supa = createSupabaseServiceClient();

  const { data, error } = await supa
    .from("cobros_periodos")
    .select(
      "id, estado, etiqueta, monto, moneda, created_at, factura_pdf_path, factura_xml_path, cobro_id, cobros(origen, titulo, proyecto_id, cotizacion_id)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (relationMissing(error.message)) {
      return { items: [], migracionPendiente: true };
    }
    console.error("[cobros] error:", error);
    return { items: [], migracionPendiente: false };
  }

  const items: Row[] = ((data ?? []) as any[]).map((r) => {
    const cobro = Array.isArray(r.cobros) ? r.cobros[0] : r.cobros;
    return {
      id: r.id,
      estado: r.estado,
      etiqueta: r.etiqueta,
      monto: Number(r.monto) || 0,
      moneda: r.moneda ?? "MXN",
      created_at: r.created_at,
      cobro_id: r.cobro_id,
      origen: cobro?.origen ?? "desarrollo",
      titulo: cobro?.titulo ?? "",
      proyecto_id: cobro?.proyecto_id ?? null,
      cotizacion_id: cobro?.cotizacion_id ?? null,
      factura_pdf_path: r.factura_pdf_path,
      factura_xml_path: r.factura_xml_path,
    };
  });

  return { items, migracionPendiente: false };
}

async function getInfoProyectos(): Promise<{
  coloresProyecto: Record<string, string>;
  emojisProyecto: Record<string, string>;
  nombresProyecto: Record<string, string>;
  nombresUnicos: string[];
}> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { coloresProyecto: {}, emojisProyecto: {}, nombresProyecto: {}, nombresUnicos: [] };
  }
  const supa = createSupabaseServiceClient();
  let { data, error }: { data: any; error: any } = await supa
    .from("proyectos")
    .select("id, nombre, color, emoji");
  if (error && /emoji/i.test(error.message)) {
    ({ data, error } = await supa.from("proyectos").select("id, nombre, color"));
  }
  const coloresProyecto: Record<string, string> = {};
  const emojisProyecto: Record<string, string> = {};
  const nombresProyecto: Record<string, string> = {};
  for (const r of (data ?? []) as any[]) {
    if (!r.id) continue;
    coloresProyecto[r.id] = r.color;
    if (r.emoji) emojisProyecto[r.id] = r.emoji;
    nombresProyecto[r.id] = r.nombre;
  }
  const nombresUnicos = Array.from(new Set(Object.values(nombresProyecto))).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );
  return { coloresProyecto, emojisProyecto, nombresProyecto, nombresUnicos };
}

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    estado?: string;
    proyecto?: string;
    desde?: string;
    hasta?: string;
    rango?: string;
    orden?: string;
  };
}) {
  const [{ items: todos, migracionPendiente }, { coloresProyecto, emojisProyecto, nombresProyecto, nombresUnicos }] =
    await Promise.all([getPeriodos(), getInfoProyectos()]);

  const rango = searchParams.rango ?? null;
  const { desde, hasta } =
    rango === "este_mes" || rango === "mes_pasado"
      ? rangoRapidoAFechas(rango)
      : { desde: searchParams.desde ?? null, hasta: searchParams.hasta ?? null };

  const q = searchParams.q?.trim().toLowerCase() || null;
  const estado = searchParams.estado || null;
  const proyecto = searchParams.proyecto || null;
  const orden = searchParams.orden || null;

  const items = todos
    .filter((it) => {
      if (q && !it.etiqueta.toLowerCase().includes(q) && !it.titulo.toLowerCase().includes(q)) return false;
      if (estado && it.estado !== estado) return false;
      if (proyecto && (!it.proyecto_id || nombresProyecto[it.proyecto_id] !== proyecto)) return false;
      if (desde && it.created_at < `${desde}T00:00:00`) return false;
      if (hasta && it.created_at > `${hasta}T23:59:59`) return false;
      return true;
    })
    .sort((a, b) => {
      if (orden === "nombre") return a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" });
      if (orden === "monto") return b.monto - a.monto;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Cobros</h1>
          <p className="text-body text-text-secondary">
            Seguimiento de pagos — desarrollo y soporte, por período.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AutoRefresh intervalSeconds={15} />
        </div>
      </header>

      {migracionPendiente ? (
        <div className="card flex items-start gap-3">
          <AlertTriangle size={20} strokeWidth={1.75} style={{ color: "var(--state-warning, #B45309)" }} />
          <div>
            <p className="text-body-medium">Falta correr la migración de Cobros</p>
            <p className="text-caption text-text-secondary mt-1">
              Corre <code>supabase/migrations/0022_cobros.sql</code> (y 0023, 0024) en el SQL
              Editor de Supabase para activar esta sección.
            </p>
          </div>
        </div>
      ) : todos.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10">
          Sin cobros todavía. Se crean automáticamente cuando una cotización pasa a
          &quot;Enviar a Cobros&quot;, o cuando corre la generación mensual de Soporte.
        </div>
      ) : (
        <>
          <FiltrosCobros
            proyectos={nombresUnicos}
            actuales={{ q: searchParams.q ?? null, estado, proyecto, desde, hasta, rango, orden }}
          />
          {items.length === 0 ? (
            <div className="card text-body text-text-secondary text-center py-10">
              Sin cobros que coincidan con los filtros.
            </div>
          ) : (
            <TableroCobros
              columnas={ORDEN_FLUJO_COBRO_PERIODO}
              itemsIniciales={items}
              coloresProyecto={coloresProyecto}
              emojisProyecto={emojisProyecto}
              nombresProyecto={nombresProyecto}
            />
          )}
        </>
      )}
    </>
  );
}
