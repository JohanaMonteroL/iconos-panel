"use client";

// Configuración de Soporte del proyecto — activar/desactivar, tipo
// (fijo/variable), horas fijas y tarifa. Mismo patrón de
// "guardar-inmediato-al-hacer-click" que ColorCampo/EmojiCampo en
// FichaProyecto.tsx, en archivo aparte para no seguir engordando ese
// componente. El cron mensual (generarPeriodosSoporteDelMes) lee estos
// campos para generar el período de cada mes.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SoporteData = {
  id: string;
  soporte_activo: boolean;
  soporte_tipo: "fijo" | "variable" | null;
  soporte_horas_fijas: number | null;
  soporte_tarifa_hora: number | null;
  precio_hora_venta: number | null;
  moneda_hora: "MXN" | "USD";
};

async function patchProyecto(
  proyectoId: string,
  patch: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/proyectos/${proyectoId}/editar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "No se pudo guardar" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Error de red" };
  }
}

function HorasFijasCampo({
  proyectoId,
  horas,
  onSaved,
}: {
  proyectoId: string;
  horas: number | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(horas != null ? String(horas) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setSaving(true);
    setError(null);
    const resultado = await patchProyecto(proyectoId, {
      soporte_horas_fijas: valor.trim() ? Number(valor) : 0,
    });
    setSaving(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar");
      return;
    }
    setEditing(false);
    onSaved();
  };

  return (
    <div>
      <label className="field-label">Horas fijas al mes</label>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            className="input num-tabular"
            type="number"
            min="0"
            step="0.5"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") guardar();
              if (e.key === "Escape") {
                setEditing(false);
                setValor(horas != null ? String(horas) : "");
                setError(null);
              }
            }}
          />
          <button type="button" className="btn-secondary btn-sm" onClick={guardar} disabled={saving}>
            {saving ? "…" : "Guardar"}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValor(horas != null ? String(horas) : "");
              setError(null);
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-between gap-2 cursor-pointer rounded-[9px]"
          style={{ border: "1px solid var(--border-default)", padding: "9px 11px" }}
          onClick={() => setEditing(true)}
        >
          <span className={horas ? "text-body num-tabular" : "text-body text-text-tertiary"}>
            {horas ? `${horas} h/mes` : "Sin capturar"}
          </span>
          <span className="text-caption" style={{ color: "var(--text-tertiary)" }}>
            Editar
          </span>
        </div>
      )}
      {error && (
        <p className="text-caption mt-1" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function TarifaCampo({
  proyectoId,
  tarifa,
  fallback,
  moneda,
  onSaved,
}: {
  proyectoId: string;
  tarifa: number | null;
  fallback: number | null;
  moneda: "MXN" | "USD";
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(tarifa != null ? String(tarifa) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setSaving(true);
    setError(null);
    const resultado = await patchProyecto(proyectoId, {
      soporte_tarifa_hora: valor.trim() ? Number(valor) : null,
    });
    setSaving(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar");
      return;
    }
    setEditing(false);
    onSaved();
  };

  const placeholder = fallback
    ? `Usa el Precio de Desarrollo (${fallback.toLocaleString("es-MX")} ${moneda}/h)`
    : "Sin capturar — usará el Precio de Desarrollo";

  return (
    <div>
      <label className="field-label">Precio de Soporte (por hora, opcional)</label>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            className="input num-tabular"
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") guardar();
              if (e.key === "Escape") {
                setEditing(false);
                setValor(tarifa != null ? String(tarifa) : "");
                setError(null);
              }
            }}
          />
          <button type="button" className="btn-secondary btn-sm" onClick={guardar} disabled={saving}>
            {saving ? "…" : "Guardar"}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValor(tarifa != null ? String(tarifa) : "");
              setError(null);
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-between gap-2 cursor-pointer rounded-[9px]"
          style={{ border: "1px solid var(--border-default)", padding: "9px 11px" }}
          onClick={() => setEditing(true)}
        >
          <span className={tarifa ? "text-body num-tabular" : "text-body text-text-tertiary"}>
            {tarifa ? `${tarifa.toLocaleString("es-MX")} ${moneda}/h` : placeholder}
          </span>
          <span className="text-caption" style={{ color: "var(--text-tertiary)" }}>
            Editar
          </span>
        </div>
      )}
      {error && (
        <p className="text-caption mt-1" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function SoporteCard({ proyecto }: { proyecto: SoporteData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (patch: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    const resultado = await patchProyecto(proyecto.id, patch);
    setSaving(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar");
      return;
    }
    router.refresh();
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-heading-2">Soporte</div>
          <p className="text-caption text-text-secondary">
            Cobro mensual recurrente — vive en Cobros junto con Desarrollo, con su propia etiqueta.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => guardar({ soporte_activo: !proyecto.soporte_activo })}
          className={proyecto.soporte_activo ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
        >
          {proyecto.soporte_activo ? "Activo" : "Inactivo"}
        </button>
      </div>

      {proyecto.soporte_activo && (
        <>
          <div>
            <label className="field-label">Tipo</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {(
                [
                  { valor: "fijo" as const, label: "Fijo — horas mensuales" },
                  { valor: "variable" as const, label: "Variable — horas reportadas" },
                ]
              ).map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  disabled={saving}
                  onClick={() => guardar({ soporte_tipo: t.valor })}
                  className={proyecto.soporte_tipo === t.valor ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {proyecto.soporte_tipo === "fijo" && (
            <HorasFijasCampo
              proyectoId={proyecto.id}
              horas={proyecto.soporte_horas_fijas}
              onSaved={() => router.refresh()}
            />
          )}

          <TarifaCampo
            proyectoId={proyecto.id}
            tarifa={proyecto.soporte_tarifa_hora}
            fallback={proyecto.precio_hora_venta}
            moneda={proyecto.moneda_hora}
            onSaved={() => router.refresh()}
          />
        </>
      )}

      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
