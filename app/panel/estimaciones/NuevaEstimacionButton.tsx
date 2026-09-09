"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";

/**
 * Crea el placeholder vacío ("por_estimar") para una solicitud que llegó
 * por un canal que no es el formulario de programadores (whatsapp, correo,
 * llamada). Johana la llena a mano después desde el detalle.
 */
export default function NuevaEstimacionButton() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [proyectoNombre, setProyectoNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    if (!nombre.trim()) {
      setError("Ponle un nombre a la solicitud.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cotizaciones/por-estimar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          proyecto_nombre: proyectoNombre.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo crear");
        return;
      }
      setAbierto(false);
      setNombre("");
      setProyectoNombre("");
      router.push(`/panel/cotizaciones/${json.id}`);
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="btn-primary"
      >
        <Plus size={16} strokeWidth={1.75} />
        <span>Nueva estimación</span>
      </button>

      <Modal
        open={abierto}
        onClose={() => !saving && setAbierto(false)}
        title="Nueva estimación"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              disabled={saving}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={crear}
              disabled={saving}
              className="btn-primary"
            >
              <Plus size={14} strokeWidth={1.75} />
              <span>{saving ? "Creando…" : "Crear"}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body text-text-secondary">
            Crea un registro vacío para una solicitud que llegó por
            WhatsApp, correo o llamada. Le agregas las tareas después,
            desde su detalle.
          </p>
          <div>
            <label className="field-label">Nombre de la solicitud *</label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Portal de proveedores — fase 2"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Proyecto (opcional)</label>
            <input
              className="input"
              value={proyectoNombre}
              onChange={(e) => setProyectoNombre(e.target.value)}
              placeholder="Nombre del proyecto en ClickUp"
            />
          </div>
          {error && (
            <p className="text-caption" style={{ color: "var(--state-error)" }}>
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
