"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type Props = {
  estimacionId: string;
  valorInicial: number;
};

const PRESETS = [0, 5, 10, 12, 15];

export default function BufferEditor({ estimacionId, valorInicial }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(valorInicial);
  const [usaCustom, setUsaCustom] = useState(!PRESETS.includes(valorInicial));
  const [custom, setCustom] = useState(
    PRESETS.includes(valorInicial) ? "" : String(valorInicial)
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDirty(value !== valorInicial);
  }, [value, valorInicial]);

  const guardar = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}/buffer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buffer_porcentaje: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo guardar");
        return;
      }
      setDirty(false);
      router.refresh();
    } catch {
      setError("Error de red");
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
        className="px-5 py-3 border-b"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <h2 className="text-heading-2">Buffer adicional</h2>
      </div>

      <div className="p-5 space-y-3">
        <p className="text-caption text-text-secondary">
          Margen extra sobre las horas estimadas. Afecta los totales que se envían al jefe y
          al cliente.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const active = !usaCustom && value === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setUsaCustom(false);
                  setCustom("");
                  setValue(p);
                }}
                className={`btn-sm ${active ? "btn-primary" : "btn-secondary"}`}
              >
                {p === 0 ? "Sin buffer" : `+${p}%`}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setUsaCustom(true);
              const n = Number(custom);
              setValue(Number.isFinite(n) ? n : 0);
            }}
            className={`btn-sm ${usaCustom ? "btn-primary" : "btn-secondary"}`}
          >
            Personalizado
          </button>

          {usaCustom && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                className="input input-sm num-tabular text-center w-20"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  const n = Number(e.target.value);
                  setValue(Number.isFinite(n) && n >= 0 ? n : 0);
                }}
                placeholder="—"
              />
              <span className="text-caption text-text-secondary">%</span>
            </div>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={saving || !dirty}
            className="btn-secondary btn-sm ml-auto"
          >
            <Save size={14} strokeWidth={1.75} />
            <span>{saving ? "…" : "Guardar"}</span>
          </button>
        </div>

        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
