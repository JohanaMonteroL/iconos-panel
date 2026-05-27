"use client";

import { Plus, Trash2 } from "lucide-react";

export type Concepto = {
  id?: string;
  concepto: string;
  cantidad: number;
  precio_unitario: number;
};

type Props = {
  conceptos: Concepto[];
  onChange: (next: Concepto[]) => void;
  disabled?: boolean;
};

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function totalConceptos(items: Concepto[]): number {
  return items.reduce(
    (s, c) => s + (Number(c.cantidad) || 0) * (Number(c.precio_unitario) || 0),
    0
  );
}

export default function ConceptosEditor({
  conceptos,
  onChange,
  disabled,
}: Props) {
  const update = (i: number, patch: Partial<Concepto>) => {
    onChange(conceptos.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const remove = (i: number) => {
    onChange(conceptos.filter((_, idx) => idx !== i));
  };
  const add = () => {
    onChange([
      ...conceptos,
      { concepto: "", cantidad: 1, precio_unitario: 0 },
    ]);
  };

  const total = totalConceptos(conceptos);

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {conceptos.map((c, i) => {
          const subtotal =
            (Number(c.cantidad) || 0) * (Number(c.precio_unitario) || 0);
          return (
            <li
              key={c.id ?? i}
              className="rounded-[12px] border overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-2 border-b"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="text-overline text-text-tertiary">
                  Concepto {i + 1}
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className="btn-icon btn-sm btn-ghost"
                  aria-label="Eliminar concepto"
                  title="Eliminar"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="field-label">Concepto</label>
                  <input
                    className="input"
                    value={c.concepto}
                    onChange={(e) => update(i, { concepto: e.target.value })}
                    disabled={disabled}
                    placeholder="Ej. Dispositivo Foo modelo X"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="field-label">Cantidad</label>
                    <input
                      className="input num-tabular text-center"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="decimal"
                      value={c.cantidad}
                      onChange={(e) =>
                        update(i, { cantidad: Number(e.target.value) || 0 })
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="field-label">Precio unitario</label>
                    <input
                      className="input num-tabular text-right"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="decimal"
                      value={c.precio_unitario}
                      onChange={(e) =>
                        update(i, {
                          precio_unitario: Number(e.target.value) || 0,
                        })
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-caption text-text-tertiary">Subtotal</div>
                    <div
                      className="num-tabular"
                      style={{ fontSize: 16, fontWeight: 700 }}
                    >
                      {fmtMxn(subtotal)}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="btn-secondary btn-sm"
        >
          <Plus size={14} strokeWidth={1.75} />
          <span>Agregar concepto</span>
        </button>
        <div
          className="text-body num-tabular"
          style={{ fontWeight: 700, fontSize: 18 }}
        >
          Total: {fmtMxn(total)}
        </div>
      </div>
    </div>
  );
}
