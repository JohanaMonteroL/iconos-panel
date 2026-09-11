import Link from "next/link";
import { Plus, Mail, Phone } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import FiltroProyectos from "./FiltroProyectos";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nombre: string;
  contacto_principal: string;
  rfc: string | null;
  correo: string | null;
  telefono: string | null;
  precio_hora_venta: number | null;
  moneda_hora: string;
  color: string;
  emoji: string;
  activo: boolean;
  created_at: string;
};

function fmtCostoHora(n: number | null, moneda: string): string {
  if (!n) return "—";
  return `${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${moneda}/h`;
}

async function getProyectos(filtros: { q: string | null; todos: boolean }): Promise<Row[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supa = createSupabaseServiceClient();
  const construir = (sel: string) => {
    let qb = supa.from("proyectos").select(sel).order("nombre", { ascending: true }).limit(500);
    if (!filtros.todos) qb = qb.eq("activo", true);
    if (filtros.q) qb = qb.ilike("nombre", `%${filtros.q}%`);
    return qb;
  };

  let { data, error }: { data: any; error: any } = await construir(
    "id, nombre, contacto_principal, rfc, correo, telefono, precio_hora_venta, moneda_hora, color, emoji, activo, created_at"
  );
  // Degradación si la migración de `emoji` todavía no se corrió.
  if (error && /emoji/i.test(error.message)) {
    ({ data, error } = await construir(
      "id, nombre, contacto_principal, rfc, correo, telefono, precio_hora_venta, moneda_hora, color, activo, created_at"
    ));
  }
  if (error) {
    console.error("[proyectos] error:", error);
    return [];
  }
  return (data ?? []) as Row[];
}

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: { q?: string; todos?: string };
}) {
  const filtros = {
    q: searchParams.q?.trim() || null,
    todos: searchParams.todos === "1",
  };
  const items = await getProyectos(filtros);

  return (
    <>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Proyectos</h1>
          <p className="text-body text-text-secondary">
            {filtros.todos ? "Mostrando todos (incluye inactivos)" : "Activos únicamente"}
          </p>
        </div>
        <Link href="/panel/proyectos/nuevo" className="btn-primary">
          <Plus size={16} strokeWidth={1.75} />
          <span>Nuevo proyecto</span>
        </Link>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <FiltroProyectos actual={filtros.q} />
        <div className="segmented inline-flex gap-1 p-1 rounded-lg">
          <Link
            href={`/panel/proyectos${filtros.q ? `?q=${filtros.q}` : ""}`}
            className={`btn-sm ${!filtros.todos ? "btn-primary" : "btn-ghost"}`}
          >
            Activos
          </Link>
          <Link
            href={`/panel/proyectos?todos=1${filtros.q ? `&q=${filtros.q}` : ""}`}
            className={`btn-sm ${filtros.todos ? "btn-primary" : "btn-ghost"}`}
          >
            Todos
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card text-body text-text-secondary text-center py-10 space-y-3">
          <p>Sin proyectos que coincidan con los filtros.</p>
          <Link href="/panel/proyectos/nuevo" className="btn-secondary inline-flex">
            <Plus size={16} strokeWidth={1.75} />
            <span>Nuevo proyecto</span>
          </Link>
        </div>
      ) : (
        <ul
          className="rounded-[14px] overflow-hidden border"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}
        >
          {/* Header (desktop) */}
          <li
            className="hidden md:grid md:grid-cols-[1.3fr_1.1fr_0.8fr_1.2fr_100px_110px] gap-3 px-4 py-2.5 text-overline text-text-tertiary"
            style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-faint)" }}
          >
            <div>Nombre</div>
            <div>Contacto principal</div>
            <div>RFC</div>
            <div>Correo / Teléfono</div>
            <div style={{ textAlign: "right" }}>Costo/hora</div>
            <div style={{ textAlign: "right" }}>Estado</div>
          </li>
          {items.map((p, i) => (
            <li key={p.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-faint)" }}>
              <Link
                href={`/panel/proyectos/${p.id}`}
                className="grid grid-cols-1 md:grid-cols-[1.3fr_1.1fr_0.8fr_1.2fr_100px_110px] gap-2 px-4 py-3 items-center hover:bg-[color:var(--bg-surface)] transition-colors"
              >
                <div className="min-w-0 flex items-start gap-2">
                  <span
                    style={{ width: 9, height: 9, borderRadius: "50%", background: p.color, flexShrink: 0, marginTop: 5 }}
                  />
                  <div className="min-w-0">
                    <div className="text-body-medium text-text-primary break-words">
                      {p.emoji ? `${p.emoji} ` : ""}
                      {p.nombre}
                    </div>
                    <div className="text-caption text-text-tertiary md:hidden mt-0.5">
                      {p.contacto_principal}
                    </div>
                  </div>
                </div>
                <div className="hidden md:block text-caption text-text-secondary break-words">
                  {p.contacto_principal}
                </div>
                <div className="hidden lg:block text-caption text-text-tertiary num-tabular">
                  {p.rfc || "—"}
                </div>
                <div className="hidden md:flex flex-col gap-0.5 text-caption text-text-tertiary min-w-0">
                  {p.correo && (
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Mail size={11} strokeWidth={1.5} />
                      {p.correo}
                    </span>
                  )}
                  {p.telefono && (
                    <span className="inline-flex items-center gap-1.5 num-tabular">
                      <Phone size={11} strokeWidth={1.5} />
                      {p.telefono}
                    </span>
                  )}
                  {!p.correo && !p.telefono && "—"}
                </div>
                <div
                  className="hidden md:block text-caption text-text-secondary num-tabular"
                  style={{ textAlign: "right" }}
                >
                  {fmtCostoHora(p.precio_hora_venta, p.moneda_hora)}
                </div>
                <div className="flex md:block" style={{ justifyContent: "flex-end" }}>
                  <span className={`badge ${p.activo ? "badge-success" : "badge-neutral"}`}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
