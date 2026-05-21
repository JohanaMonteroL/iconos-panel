"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (extras: { checkboxMarcado: boolean }) => Promise<void> | void;
  titulo: string;
  descripcion: React.ReactNode;
  /** Palabra exacta que el usuario debe escribir (case-insensitive). */
  palabraClave: string;
  /** Texto del botón de confirmación. */
  textoBoton?: string;
  /** Pinta el botón en rojo (acción destructiva). */
  peligroso?: boolean;
  /** Si se pasa, se muestra un checkbox opcional encima del input. */
  checkbox?: {
    label: React.ReactNode;
    descripcion?: React.ReactNode;
    inicial?: boolean;
  };
};

export default function ConfirmAccionModal({
  open,
  onClose,
  onConfirm,
  titulo,
  descripcion,
  palabraClave,
  textoBoton,
  peligroso = false,
  checkbox,
}: Props) {
  const [valor, setValor] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkboxMarcado, setCheckboxMarcado] = useState<boolean>(
    checkbox?.inicial ?? false
  );

  useEffect(() => {
    if (open) {
      setValor("");
      setError(null);
      setWorking(false);
      setCheckboxMarcado(checkbox?.inicial ?? false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const coincide = valor.trim().toLowerCase() === palabraClave.toLowerCase();

  const confirmar = async () => {
    if (!coincide) return;
    setWorking(true);
    setError(null);
    try {
      await onConfirm({ checkboxMarcado });
    } catch (e: any) {
      setError(e?.message || "Error al ejecutar la acción");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !working && onClose()}
      title={titulo}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!coincide || working}
            className={peligroso ? "btn-danger" : "btn-primary"}
          >
            {working ? "Procesando…" : textoBoton ?? "Confirmar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-body text-text-secondary">{descripcion}</div>

        {checkbox && (
          <label
            className="flex items-start gap-3 rounded-[10px] p-3 cursor-pointer"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={checkboxMarcado}
              onChange={(e) => setCheckboxMarcado(e.target.checked)}
              disabled={working}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: "#0066FF" }}
            />
            <span className="flex-1 text-body">
              <span className="text-body-medium text-text-primary">{checkbox.label}</span>
              {checkbox.descripcion && (
                <span className="block text-caption text-text-secondary mt-1">
                  {checkbox.descripcion}
                </span>
              )}
            </span>
          </label>
        )}

        <div>
          <label className="field-label">
            Para confirmar, escribe{" "}
            <span
              className="num-tabular"
              style={{
                background: "var(--bg-overlay)",
                padding: "2px 6px",
                borderRadius: 4,
                color: peligroso ? "var(--state-error)" : "var(--text-primary)",
                fontWeight: 600,
              }}
            >
              {palabraClave}
            </span>{" "}
            abajo:
          </label>
          <input
            className="input"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            placeholder={palabraClave}
            onKeyDown={(e) => {
              if (e.key === "Enter" && coincide && !working) confirmar();
            }}
          />
        </div>

        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
