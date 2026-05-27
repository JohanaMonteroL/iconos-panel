"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Save, X } from "lucide-react";
import ConceptosEditor, {
  totalConceptos,
  type Concepto,
} from "@/components/forms/ConceptosEditor";

type Props = {
  cotizacionId: string;
  conceptosIniciales: Concepto[];
  montoTotal: number;
};

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function ConceptosCotizacionCard({
  cotizacionId,
  conceptosIniciales,
  montoTotal,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [conceptos, setConceptos] = useState<Concepto[]>(conceptosIniciales);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn" | "err"; texto: string } | null>(
    null
  );

  useEffect(() => {
    setConceptos(conceptosIniciales);
  }, [conceptosIniciales]);

  const totalEditando = totalConceptos(conceptos);

  const cancelar = () => {
    setConceptos(conceptosIniciales);
    setEditing(false);
    setMsg(null);
  };

  const guardar = async () => {
    const validos = conceptos.filter(
      (c) => c.concepto.trim().length > 0 && c.cantidad > 0
    );
    if (validos.length === 0) {
      setMsg({ tipo: "err", texto: "Al menos un concepto debe tener nombre y cantidad > 0" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/cotizaciones/${cotizacionId}/conceptos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conceptos: validos.map((c) => ({
              concepto: c.concepto.trim(),
              cantidad: Number(c.cantidad) || 0,
              precio_unitario: Number(c.precio_unitario) || 0,
            })),
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      if (json.clickup_warning) {
        setMsg({ tipo: "warn", texto: `Guardado. ClickUp: ${json.clickup_warning}` });
      } else {
        setMsg({ tipo: "ok", texto: "Conceptos actualizados" });
        setTimeout(() => setMsg(null), 2500);
      }
      setEditing(false);
      router.refresh();
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="rounded-[12px] overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <h2 className="text-heading-2">Conceptos</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-caption text-text-secondary num-tabular">
            Total:{" "}
            <strong className="text-text-primary font-semibold">
              {fmtMxn(editing ? totalEditando : montoTotal)}
            </strong>
          </span>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary btn-sm"
            >
              <Edit3 size={14} strokeWidth={1.75} />
              <span>Editar</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelar}
                disabled={saving}
                className="btn-ghost btn-sm"
              >
                <X size={14} strokeWidth={1.75} />
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={saving}
                className="btn-primary btn-sm"
              >
                <Save size={14} strokeWidth={1.75} />
                <span>{saving ? "Guardando…" : "Guardar"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {editing ? (
          <ConceptosEditor conceptos={conceptos} onChange={setConceptos} />
        ) : conceptosIniciales.length === 0 ? (
          <p className="text-body text-text-secondary">
            Sin conceptos. La cotización tiene solo el monto total.
          </p>
        ) : (
          <ul className="space-y-2">
            {conceptosIniciales.map((c, i) => {
              const subtotal = c.cantidad * c.precio_unitario;
              return (
                <li
                  key={c.id ?? i}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="min-w-0">
                    <div className="text-body-medium truncate">{c.concepto}</div>
                    <div className="text-caption text-text-tertiary num-tabular">
                      {c.cantidad}× a {fmtMxn(c.precio_unitario)} c/u
                    </div>
                  </div>
                  <div className="text-body-medium num-tabular whitespace-nowrap">
                    {fmtMxn(subtotal)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {msg && (
          <p
            className="text-caption"
            style={{
              color:
                msg.tipo === "ok"
                  ? "var(--state-success)"
                  : msg.tipo === "warn"
                  ? "var(--state-warning)"
                  : "var(--state-error)",
            }}
          >
            {msg.tipo === "ok" ? "✓" : "⚠"} {msg.texto}
          </p>
        )}
      </div>
    </section>
  );
}
