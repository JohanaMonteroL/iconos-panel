"use client";

import { useState } from "react";
import { Eye, EyeOff, Save } from "lucide-react";

export default function PasswordForm() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva, confirma }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error");
        return;
      }
      setSuccess("✓ Contraseña actualizada");
      setActual("");
      setNueva("");
      setConfirma("");
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 max-w-md">
      <div>
        <label className="field-label">Contraseña actual</label>
        <div className="flex gap-2">
          <input
            className="input"
            type={show ? "text" : "password"}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="btn-icon btn-secondary"
            aria-label={show ? "Ocultar" : "Mostrar"}
          >
            {show ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <div>
        <label className="field-label">Nueva contraseña</label>
        <input
          className="input"
          type={show ? "text" : "password"}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          autoComplete="new-password"
        />
        <span className="field-hint">Mínimo 8 caracteres</span>
      </div>

      <div>
        <label className="field-label">Confirmar nueva contraseña</label>
        <input
          className="input"
          type={show ? "text" : "password"}
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
      {success && (
        <p className="text-caption" style={{ color: "var(--state-success)" }}>
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !actual || !nueva || !confirma}
        className="btn-primary"
      >
        <Save size={16} strokeWidth={1.75} />
        <span>{saving ? "Guardando…" : "Cambiar contraseña"}</span>
      </button>
    </form>
  );
}
