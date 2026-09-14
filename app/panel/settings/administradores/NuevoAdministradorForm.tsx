"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function NuevoAdministradorForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setNombre("");
    setCorreo("");
    setError(null);
  };

  const guardar = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/administradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), correo: correo.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo crear");
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} strokeWidth={1.75} />
        <span>Añadir administrador</span>
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-heading-2">Nuevo administrador</h2>
        <button
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="btn-icon btn-ghost"
          aria-label="Cancelar"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Nombre *</label>
          <input
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Regina Ávila"
            autoFocus
          />
        </div>
        <div>
          <label className="field-label">Correo *</label>
          <input
            className="input"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="admin@iconos.mx"
          />
          <span className="field-hint">Es el usuario con el que entrará al panel.</span>
        </div>
      </div>
      <p className="text-caption text-text-secondary">
        Después de crearlo, genera su contraseña temporal con el ícono de llave en su fila.
      </p>
      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={guardar}
          disabled={saving || !nombre.trim() || !correo.trim()}
          className="btn-primary"
        >
          {saving ? "Guardando…" : "Crear"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            reset();
          }}
          disabled={saving}
          className="btn-ghost"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
