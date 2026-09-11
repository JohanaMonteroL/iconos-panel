"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import CostoHoraField, { type Moneda } from "../CostoHoraField";
import ColorPicker from "../ColorPicker";
import EmojiPicker from "../EmojiPicker";

export type ProyectoData = {
  id: string;
  nombre: string;
  contacto_principal: string;
  rfc: string | null;
  correo: string | null;
  telefono: string | null;
  precio_hora_venta: number | null;
  moneda_hora: Moneda;
  color: string;
  emoji: string;
  notas: string | null;
  activo: boolean;
  soporte_activo: boolean;
  soporte_tipo: "fijo" | "variable" | null;
  soporte_horas_fijas: number | null;
  soporte_tarifa_hora: number | null;
};

function Campo({
  proyectoId,
  campo,
  label,
  valor,
  placeholder,
  tipo = "text",
  requerido = false,
  multilinea = false,
}: {
  proyectoId: string;
  campo: string;
  label: string;
  valor: string | null;
  placeholder?: string;
  tipo?: string;
  requerido?: boolean;
  multilinea?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(valor ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (requerido && !value.trim()) {
      setError("Este campo no puede quedar vacío");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: value.trim() || null }),
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

  return (
    <div>
      {label && <label className="field-label">{label}</label>}
      {editing ? (
        <div className={multilinea ? "space-y-2" : "flex items-center gap-2"}>
          {multilinea ? (
            <textarea
              className="textarea"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              placeholder={placeholder}
              rows={6}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditing(false);
                  setValue(valor ?? "");
                  setError(null);
                }
              }}
            />
          ) : (
            <input
              className="input"
              type={tipo}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardar();
                if (e.key === "Escape") {
                  setEditing(false);
                  setValue(valor ?? "");
                  setError(null);
                }
              }}
            />
          )}
          <div className={multilinea ? "flex gap-2" : "contents"}>
            <button type="button" className="btn-secondary btn-sm" onClick={guardar} disabled={saving}>
              {saving ? "…" : "Guardar"}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setValue(valor ?? "");
                setError(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div
          className={multilinea ? "cursor-pointer rounded-[9px]" : "flex items-center justify-between gap-2 cursor-pointer rounded-[9px]"}
          style={{ border: "1px solid var(--border-default)", padding: "9px 11px" }}
          onClick={() => setEditing(true)}
        >
          <span
            className={valor ? "text-body" : "text-body text-text-tertiary"}
            style={multilinea ? { whiteSpace: "pre-wrap", display: "block" } : undefined}
          >
            {valor || placeholder || "—"}
          </span>
          {!multilinea && (
            <span className="text-caption" style={{ color: "var(--text-tertiary)" }}>
              Editar
            </span>
          )}
        </div>
      )}
      {error && (
        <p className="text-caption mt-1" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Costo por hora — monto + moneda, se guardan juntos en un solo PATCH. */
function CostoHoraCampo({
  proyectoId,
  precioHoraVenta,
  monedaHora,
}: {
  proyectoId: string;
  precioHoraVenta: number | null;
  monedaHora: Moneda;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(precioHoraVenta != null ? String(precioHoraVenta) : "");
  const [moneda, setMoneda] = useState<Moneda>(monedaHora);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          precio_hora_venta: valor.trim() ? Number(valor) : 0,
          moneda_hora: moneda,
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

  return (
    <div>
      <label className="field-label">Costo por hora</label>
      {editing ? (
        <div className="flex items-center gap-2">
          <CostoHoraField valor={valor} moneda={moneda} onValorChange={setValor} onMonedaChange={setMoneda} autoFocus />
          <button type="button" className="btn-secondary btn-sm" onClick={guardar} disabled={saving}>
            {saving ? "…" : "Guardar"}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValor(precioHoraVenta != null ? String(precioHoraVenta) : "");
              setMoneda(monedaHora);
              setError(null);
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-between gap-2 cursor-pointer rounded-[9px]"
          style={{ border: "1px solid var(--border-default)", padding: "9px 11px" }}
          onClick={() => setEditing(true)}
        >
          <span className={precioHoraVenta ? "text-body num-tabular" : "text-body text-text-tertiary"}>
            {precioHoraVenta ? `${precioHoraVenta.toLocaleString("es-MX")} ${monedaHora}/h` : "Sin capturar"}
          </span>
          <span className="text-caption" style={{ color: "var(--text-tertiary)" }}>
            Editar
          </span>
        </div>
      )}
      {error && (
        <p className="text-caption mt-1" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Color de etiqueta — picker de +20 opciones, se guarda solo. */
function ColorCampo({ proyectoId, color }: { proyectoId: string; color: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (nuevoColor: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: nuevoColor }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo guardar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="field-label">Color de etiqueta</label>
      <ColorPicker valor={color} onChange={guardar} disabled={saving} />
      {error && (
        <p className="text-caption mt-1" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Emoji del proyecto — picker de opciones curadas, se guarda solo. */
function EmojiCampo({ proyectoId, emoji }: { proyectoId: string; emoji: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (nuevoEmoji: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: nuevoEmoji }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo guardar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="field-label">Emoji</label>
      <EmojiPicker valor={emoji} onChange={guardar} disabled={saving} />
      {error && (
        <p className="text-caption mt-1" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Card de "Datos generales" — todo excepto notas (va en su propia card). */
export function DatosGeneralesCard({ proyecto }: { proyecto: ProyectoData }) {
  return (
    <div className="card space-y-4">
      <Campo
        proyectoId={proyecto.id}
        campo="nombre"
        label="Nombre del proyecto"
        valor={proyecto.nombre}
        requerido
      />
      <Campo
        proyectoId={proyecto.id}
        campo="contacto_principal"
        label="Contacto principal"
        valor={proyecto.contacto_principal}
        requerido
      />
      <Campo
        proyectoId={proyecto.id}
        campo="rfc"
        label="RFC"
        valor={proyecto.rfc}
        placeholder="Sin capturar"
      />
      <Campo
        proyectoId={proyecto.id}
        campo="correo"
        label="Correo electrónico"
        valor={proyecto.correo}
        placeholder="Sin capturar"
        tipo="email"
      />
      <Campo
        proyectoId={proyecto.id}
        campo="telefono"
        label="Teléfono"
        valor={proyecto.telefono}
        placeholder="Sin capturar"
        tipo="tel"
      />
      <CostoHoraCampo
        proyectoId={proyecto.id}
        precioHoraVenta={proyecto.precio_hora_venta}
        monedaHora={proyecto.moneda_hora}
      />
      <ColorCampo proyectoId={proyecto.id} color={proyecto.color} />
      <EmojiCampo proyectoId={proyecto.id} emoji={proyecto.emoji} />
    </div>
  );
}

export function NotasCard({ proyecto }: { proyecto: ProyectoData }) {
  return (
    <div className="card">
      <div className="text-heading-2 mb-3">Notas</div>
      <Campo
        proyectoId={proyecto.id}
        campo="notas"
        label=""
        valor={proyecto.notas}
        placeholder="Sin notas — condiciones especiales, horarios, preferencias, etc."
        multilinea
      />
    </div>
  );
}

export function EstadoCard({ proyecto }: { proyecto: ProyectoData }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarEstado = async (activo: boolean) => {
    if (!activo && !window.confirm(`¿Marcar a "${proyecto.nombre}" como inactivo? Podrás reactivarlo cuando quieras.`)) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo actualizar el estado");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="card flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-body-medium">
            Estado: {proyecto.activo ? "Activo" : "Inactivo"}
          </div>
          <p className="text-caption text-text-secondary">
            Los proyectos nunca se eliminan — solo se marcan como inactivos.
          </p>
        </div>
        {proyecto.activo ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={working}
            onClick={() => cambiarEstado(false)}
          >
            <Ban size={16} strokeWidth={1.75} />
            <span>Inactivar</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={working}
            onClick={() => cambiarEstado(true)}
          >
            <CheckCircle2 size={16} strokeWidth={1.75} />
            <span>Reactivar</span>
          </button>
        )}
      </div>
      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
