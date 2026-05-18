"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  titulo: string;
  descripcion: React.ReactNode;
  /** Palabra exacta que el usuario debe escribir (case-insensitive). */
  palabraClave: string;
  /** Texto del botón de confirmación. */
  textoBoton?: string;
  /** Pinta el botón en rojo (acción destructiva). */
  peligroso?: boolean;
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
}: Props) {
  const [valor, setValor] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValor("");
      setError(null);
      setWorking(false);
    }
  }, [open]);

  const coincide = valor.trim().toLowerCase() === palabraClave.toLowerCase();

  const confirmar = async () => {
    if (!coincide) return;
    setWorking(true);
    setError(null);
    try {
      await onConfirm();
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
