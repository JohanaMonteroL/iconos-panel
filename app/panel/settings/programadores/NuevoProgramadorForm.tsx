"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function NuevoProgramadorForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [slackId, setSlackId] = useState("");
  const [correo, setCorreo] = useState("");
  const [precio, setPrecio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setNombre("");
    setSlackId("");
    setCorreo("");
    setPrecio("");
    setError(null);
  };

  const guardar = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/programadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          slack_id: slackId.trim() || null,
          correo: correo.trim() || null,
          precio_hora: Number(precio),
        }),
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
        <span>Añadir programador</span>
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-heading-2">Nuevo programador</h2>
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
            placeholder="Adrian Delgado"
            autoFocus
          />
        </div>
        <div>
          <label className="field-label">Correo (Slack DM)</label>
          <input
            className="input"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="programador@iconos.mx"
          />
          <span className="field-hint">
            Para los DMs de tickets cuando JIRA oculta el email.
          </span>
        </div>
        <div>
          <label className="field-label">Slack ID (opcional)</label>
          <input
            className="input"
            value={slackId}
            onChange={(e) => setSlackId(e.target.value)}
            placeholder="U0123ABCDE"
          />
        </div>
        <div>
          <label className="field-label">Precio por hora (MXN) *</label>
          <input
            className="input num-tabular"
            type="number"
            min={0}
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="200"
          />
        </div>
      </div>
      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={guardar}
          disabled={saving || !nombre.trim() || !precio}
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
