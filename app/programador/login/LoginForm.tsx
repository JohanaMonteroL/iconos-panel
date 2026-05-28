"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Lock, Mail } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/programador/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correo.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo iniciar sesión");
        return;
      }
      if (json.must_change_password) {
        router.push("/programador/cambiar-password");
      } else {
        router.push("/programador");
      }
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
      <h2 className="text-heading-2 text-center">Iniciar sesión</h2>

      <div>
        <label className="field-label">
          <Mail size={12} strokeWidth={1.75} className="inline mr-1" />
          Correo
        </label>
        <input
          type="email"
          className="input"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="tu@iconos.mx"
          autoComplete="username"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="field-label">
          <Lock size={12} strokeWidth={1.75} className="inline mr-1" />
          Contraseña
        </label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <p className="text-caption text-center" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !correo || !password}
        className="btn-primary w-full"
      >
        <LogIn size={16} strokeWidth={1.75} />
        <span>{loading ? "Entrando…" : "Entrar"}</span>
      </button>

      <p className="text-caption text-text-tertiary text-center">
        ¿Olvidaste tu contraseña? Pídele a Johana que te la resetee.
      </p>
    </form>
  );
}
