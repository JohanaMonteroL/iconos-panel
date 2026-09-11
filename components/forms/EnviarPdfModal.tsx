"use client";

import { useRef, useState } from "react";
import { FileUp, Send } from "lucide-react";
import Modal from "@/components/ui/Modal";

type Props = {
  cotizacionId: string;
  open: boolean;
  onClose: () => void;
  // Se llama cuando el envío se confirmó (PDF subido + estado -> "enviada").
  onEnviado: () => void;
  // Para el preview del costo aproximado (mismo cálculo que hace el
  // servidor: horas totales × precio/hora interno del programador).
  horasEnvio?: number;
  precioHora?: number;
};

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Pide el PDF que se le mandó al cliente y muestra el detalle auto-calculado
 * (horas totales, quién estimó, costo aproximado) antes de confirmar. Al
 * confirmar sube el archivo a /api/cotizaciones/[id]/enviar-pdf, que
 * también cambia el estado a "enviada".
 */
export default function EnviarPdfModal({
  cotizacionId,
  open,
  onClose,
  onEnviado,
  horasEnvio = 0,
  precioHora = 0,
}: Props) {
  const costoAproximado = Math.round(horasEnvio * precioHora * 100) / 100;
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombreDocumento, setNombreDocumento] = useState("");
  const [nombreEditadoAMano, setNombreEditadoAMano] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    if (enviando) return;
    setArchivo(null);
    setNombreDocumento("");
    setNombreEditadoAMano(false);
    setError(null);
    onClose();
  };

  const elegirArchivo = (f: File | null) => {
    setArchivo(f);
    // Si Johana no ha escrito su propio nombre, lo prellenamos con el
    // nombre del archivo (sin extensión) para que no tenga que repetirlo.
    if (f && !nombreEditadoAMano) {
      setNombreDocumento(f.name.replace(/\.pdf$/i, ""));
    }
  };

  const enviar = async () => {
    if (!archivo) {
      setError("Elige el PDF que se le mandó al cliente.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", archivo);
      if (nombreDocumento.trim()) {
        form.append("nombre_documento", nombreDocumento.trim());
      }
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/enviar-pdf`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo subir el PDF");
        return;
      }
      setArchivo(null);
      setNombreDocumento("");
      setNombreEditadoAMano(false);
      onEnviado();
    } catch {
      setError("Error de red");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Marcar como Enviada"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={cerrar}
            disabled={enviando}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !archivo}
            className="btn-primary"
          >
            <Send size={14} strokeWidth={1.75} />
            <span>{enviando ? "Subiendo…" : "Confirmar envío"}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-text-secondary">
          Sube el PDF que se le mandó al cliente. Al confirmar, la cotización
          pasa a <strong>Enviada al cliente</strong> y queda guardado el
          detalle del envío (horas totales, quién estimó, costo aproximado y
          fecha) para consultarlo después.
        </p>

        <div>
          <label className="field-label">PDF de la cotización *</label>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            className="input"
            style={{ paddingTop: 8 }}
          />
          <span className="field-hint">Un solo archivo, máximo 15 MB.</span>
        </div>

        <div>
          <label className="field-label">Nombre del documento</label>
          <input
            type="text"
            className="input"
            value={nombreDocumento}
            onChange={(e) => {
              setNombreDocumento(e.target.value);
              setNombreEditadoAMano(true);
            }}
            placeholder="Ej: Cotización — Sistema de Nómina"
          />
          <span className="field-hint">
            Cómo se va a llamar este documento en el historial. Si lo dejas
            vacío, se usa el nombre del archivo.
          </span>
        </div>

        <div
          className="rounded-[10px] p-4 grid grid-cols-3 gap-4"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div className="text-overline text-text-tertiary">Horas totales</div>
            <div className="mt-1 num-tabular text-body-medium">{horasEnvio}h</div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary">Costo aprox.</div>
            <div className="mt-1 num-tabular text-body-medium">
              {fmtMxn(costoAproximado)}
            </div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary">Fecha</div>
            <div className="mt-1 text-body-medium">
              {new Date().toLocaleDateString("es-MX")}
            </div>
          </div>
        </div>

        {archivo && (
          <div
            className="rounded-[10px] p-3 flex items-center gap-2 text-caption"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <FileUp size={14} strokeWidth={1.75} className="text-text-secondary" />
            <span className="text-text-primary">{archivo.name}</span>
            <span className="text-text-tertiary ml-auto num-tabular">
              {(archivo.size / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
        )}

        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
