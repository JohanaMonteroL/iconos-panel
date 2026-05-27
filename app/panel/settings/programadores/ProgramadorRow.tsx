"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Save, X, ToggleLeft, ToggleRight } from "lucide-react";

export type Programador = {
  id: string;
  nombre: string;
  slack_id: string | null;
  correo: string | null;
  jira_account_id: string | null;
  precio_hora: number;
  activo: boolean;
};

export type JiraUserSimple = {
  accountId: string;
  displayName: string;
  emailAddress: string | null;
};

export default function ProgramadorRow({
  p,
  jiraUsers = [],
}: {
  p: Programador;
  jiraUsers?: JiraUserSimple[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(p.nombre);
  const [slackId, setSlackId] = useState(p.slack_id ?? "");
  const [correo, setCorreo] = useState(p.correo ?? "");
  const [jiraAccountId, setJiraAccountId] = useState(p.jira_account_id ?? "");
  const [precio, setPrecio] = useState(String(p.precio_hora));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/programadores/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          slack_id: slackId.trim() || null,
          correo: correo.trim() || null,
          jira_account_id: jiraAccountId.trim() || null,
          precio_hora: Number(precio),
        }),
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
      const res = await fetch(`/api/programadores/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !p.activo }),
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
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
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
              Mismo correo que usa en Slack. Se busca por nombre en los DMs
              de tickets cuando JIRA oculta su email.
            </span>
          </div>
          <div>
            <label className="field-label">Usuario en JIRA (opcional)</label>
            {jiraUsers.length === 0 ? (
              <input
                className="input"
                value={jiraAccountId}
                onChange={(e) => setJiraAccountId(e.target.value)}
                placeholder="accountId de JIRA"
              />
            ) : (
              <select
                className="input"
                value={jiraAccountId}
                onChange={(e) => setJiraAccountId(e.target.value)}
              >
                <option value="">— sin vincular —</option>
                {jiraUsers.map((u) => (
                  <option key={u.accountId} value={u.accountId}>
                    {u.displayName}
                    {u.emailAddress ? ` · ${u.emailAddress}` : ""}
                  </option>
                ))}
              </select>
            )}
            <span className="field-hint">
              Vincula este programador con su usuario en JIRA por accountId.
              Útil cuando el displayName de JIRA difiere del nombre interno.
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
            <label className="field-label">Precio por hora (MXN)</label>
            <input
              className="input num-tabular"
              type="number"
              min={0}
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
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
              setNombre(p.nombre);
              setSlackId(p.slack_id ?? "");
              setCorreo(p.correo ?? "");
              setJiraAccountId(p.jira_account_id ?? "");
              setPrecio(String(p.precio_hora));
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
      className={`card-tight card flex items-center justify-between gap-3 ${
        p.activo ? "" : "opacity-60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-body-medium">
          {p.nombre}
          {!p.activo && <span className="ml-2 badge badge-neutral">inactivo</span>}
        </div>
        <div className="text-caption text-text-tertiary flex flex-wrap gap-x-3 gap-y-1 mt-1">
          <span className="num-tabular">
            ${p.precio_hora.toLocaleString("es-MX")} / hr
          </span>
          {p.correo && <span>📧 {p.correo}</span>}
          {p.jira_account_id && <span>🔗 JIRA vinculado</span>}
          {p.slack_id && <span>Slack: {p.slack_id}</span>}
        </div>
        {error && (
          <p className="text-caption mt-2" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleActivo}
          disabled={saving}
          className="btn-icon btn-ghost"
          title={p.activo ? "Desactivar" : "Activar"}
          aria-label={p.activo ? "Desactivar" : "Activar"}
        >
          {p.activo ? (
            <ToggleRight size={20} strokeWidth={1.5} style={{ color: "var(--state-success)" }} />
          ) : (
            <ToggleLeft size={20} strokeWidth={1.5} className="text-text-tertiary" />
          )}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="btn-icon btn-ghost"
          aria-label="Editar"
        >
          <Edit3 size={16} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}
