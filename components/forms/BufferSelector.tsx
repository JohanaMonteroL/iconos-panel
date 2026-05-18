"use client";

import { useState, useEffect } from "react";

type Props = {
  value: number; // 0..N (porcentaje)
  onChange: (n: number) => void;
};

const PRESETS = [0, 5, 10, 12, 15];

export default function BufferSelector({ value, onChange }: Props) {
  const isPreset = PRESETS.includes(value);
  const [usaCustom, setUsaCustom] = useState(!isPreset);
  const [custom, setCustom] = useState(isPreset ? "" : String(value));

  // Si value llega externamente y coincide con un preset, dejamos custom apagado
  useEffect(() => {
    if (PRESETS.includes(value)) {
      setUsaCustom(false);
      setCustom("");
    }
  }, [value]);

  return (
    <div className="space-y-3">
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
                onChange(p);
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
            onChange(Number.isFinite(n) ? n : 0);
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
                onChange(Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              placeholder="—"
            />
            <span className="text-caption text-text-secondary">%</span>
          </div>
        )}
      </div>
    </div>
  );
}
