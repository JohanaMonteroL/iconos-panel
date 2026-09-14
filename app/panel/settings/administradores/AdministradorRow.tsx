"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Save, X, ToggleLeft, ToggleRight, KeyRound, Copy } from "lucide-react";

export type Administrador = {
  id: string;
  nombre: string;
  correo: string;
  must_change_password: boolean;
  activo: boolean;
};

export default function AdministradorRow({ a }: { a: Administrador }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(a.nombre);
  const [correo, setCorreo] = useState(a.correo);
  const [reseteando, setReseteando] = useState(false);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
  const [passwordCopiada, setPasswordCopiada] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetearPassword = async () => {
    if (
      !confirm(
        `¿Generar nueva contraseña temporal para ${a.nombre}? Si ya tenía contraseña la pierde.`
      )
    ) {
      return;
    }
    setReseteando(true);
    setResetError(null);
    setPasswordTemporal(null);
    setPasswordCopiada(false);
    try {
      const res = await fetch(`/api/administradores/${a.id}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setResetError(json.error || "No se pudo resetear");
        return;
      }
      setPasswordTemporal(json.password);
      router.refresh();
    } catch {
      setResetError("Error de red");
    } finally {
      setReseteando(false);
    }
  };

  const copiarPassword = async () => {
    if (!passwordTemporal) return;
    try {
      await navigator.clipboard.writeText(passwordTemporal);
      setPasswordCopiada(true);
      setTimeout(() => setPasswordCopiada(false), 2000);
    } catch {}
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/administradores/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), correo: correo.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo guardar");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/administradores/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !a.activo }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "No se pudo cambiar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <li className="card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Nombre</label>
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Correo</label>
            <input
              className="input"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary btn-sm">
            <Save size={14} strokeWidth={1.75} />
            <span>{saving ? "Guardando…" : "Guardar"}</span>
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setNombre(a.nombre);
              setCorreo(a.correo);
              setError(null);
            }}
            disabled={saving}
            className="btn-ghost btn-sm"
          >
            <X size={14} strokeWidth={1.75} />
            <span>Cancelar</span>
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`card-tight card flex items-center justify-between gap-3 relative ${
        a.activo ? "" : "opacity-60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-body-medium">
          {a.nombre}
          {!a.activo && <span className="ml-2 badge badge-neutral">inactivo</span>}
          {a.must_change_password && a.activo && (
            <span className="ml-2 badge badge-neutral">contraseña temporal pendiente</span>
          )}
        </div>
        <div className="text-caption text-text-tertiary flex flex-wrap gap-x-3 gap-y-1 mt-1">
          <span>📧 {a.correo}</span>
        </div>
        {error && (
          <p className="text-caption mt-2" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={resetearPassword}
          disabled={saving || reseteando}
          className="btn-icon btn-ghost"
          title="Generar contraseña temporal"
          aria-label="Generar contraseña temporal"
        >
          <KeyRound size={16} strokeWidth={1.75} />
        </button>
        <button
          onClick={toggleActivo}
          disabled={saving}
          className="btn-icon btn-ghost"
          title={a.activo ? "Desactivar" : "Activar"}
          aria-label={a.activo ? "Desactivar" : "Activar"}
        >
          {a.activo ? (
            <ToggleRight size={20} strokeWidth={1.5} style={{ color: "var(--state-success)" }} />
          ) : (
            <ToggleLeft size={20} strokeWidth={1.5} className="text-text-tertiary" />
          )}
        </button>
        <button onClick={() => setEditing(true)} className="btn-icon btn-ghost" aria-label="Editar">
          <Edit3 size={16} strokeWidth={1.75} />
        </button>
      </div>

      {(passwordTemporal || resetError) && (
        <div
          className="absolute right-0 mt-2 rounded-[10px] p-3 max-w-md"
          style={{
            background: "var(--bg-elevated)",
            border: `1px solid ${resetError ? "var(--state-error)" : "var(--state-success)"}`,
            boxShadow: "var(--shadow-md)",
            zIndex: 10,
          }}
        >
          {resetError ? (
            <p className="text-caption" style={{ color: "var(--state-error)" }}>
              ⚠ {resetError}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="text-body-medium" style={{ color: "var(--state-success)" }}>
                ✓ Contraseña temporal generada
              </div>
              <p className="text-caption text-text-secondary">
                Cópiala AHORA — no se vuelve a mostrar. Mándasela a {a.nombre}. Le pedirá
                cambiarla en su primer login.
              </p>
              <div
                className="flex items-center gap-2 p-2 rounded-[8px] num-tabular"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 14,
                }}
              >
                <span className="flex-1 select-all">{passwordTemporal}</span>
                <button type="button" onClick={copiarPassword} className="btn-secondary btn-sm">
                  <Copy size={12} strokeWidth={1.75} />
                  <span>{passwordCopiada ? "Copiada" : "Copiar"}</span>
                </button>
              </div>
              <button type="button" onClick={() => setPasswordTemporal(null)} className="btn-ghost btn-sm">
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
