"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Lock } from "lucide-react";

export default function CambiarPasswordForm({
  obligatorio,
}: {
  obligatorio: boolean;
}) {
  const router = useRouter();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valido =
    actual.length >= 1 && nueva.length >= 8 && nueva === confirmar;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/programador/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password_actual: actual,
          password_nueva: nueva,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo cambiar la contraseña");
        return;
      }
      router.push("/programador");
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="card space-y-4"
      style={{ background: "var(--bg-elevated)" }}
    >
      <div>
        <label className="field-label">
          <Lock size={12} strokeWidth={1.75} className="inline mr-1" />
          Contraseña actual
        </label>
        <input
          type="password"
          className="input"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      <div>
        <label className="field-label">Contraseña nueva</label>
        <input
          type="password"
          className="input"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="field-hint">Mínimo 8 caracteres.</span>
      </div>

      <div>
        <label className="field-label">Confirmar nueva</label>
        <input
          type="password"
          className="input"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          autoComplete="new-password"
          required
        />
        {confirmar.length > 0 && confirmar !== nueva && (
          <span
            className="field-hint"
            style={{ color: "var(--state-error)" }}
          >
            No coincide con la nueva contraseña.
          </span>
        )}
      </div>

      {error && (
        <p className="text-caption text-center" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !valido}
        className="btn-primary w-full"
      >
        <Save size={16} strokeWidth={1.75} />
        <span>{loading ? "Guardando…" : "Guardar contraseña"}</span>
      </button>

      {!obligatorio && (
        <button
          type="button"
          onClick={() => router.push("/programador")}
          className="btn-ghost w-full"
        >
          Cancelar
        </button>
      )}
    </form>
  );
}
