"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Sparkles } from "lucide-react";

type Props = {
  cotizacionId: string;
  field: "contexto_sherlyn" | "borrador_correo";
  label: string;
  initialValue: string | null;
  rows?: number;
  placeholder?: string;
  // Si se provee, muestra botón "Formatear con IA" que llama a
  // /api/cotizaciones/formatear-texto con este tipo.
  iaTipo?: "correo" | "sherlyn";
  // Contexto adicional opcional para alimentar a la IA (ej. monto, nombre).
  iaContexto?: string;
};

/**
 * Card autosuficiente para editar un campo de texto largo de la cotización
 * (contexto Sherlyn, borrador de correo). Cada uno con su propio Save —
 * mismo patrón que las cards independientes de RevisionIA.
 */
export default function InlineTextEditor({
  cotizacionId,
  field,
  label,
  initialValue,
  rows = 6,
  placeholder,
  iaTipo,
  iaContexto,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState<string>(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [formateando, setFormateando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn" | "err"; texto: string } | null>(
    null
  );

  // Sincronizar con prop si cambia (después de un refresh).
  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  const dirty = (value ?? "") !== (initialValue ?? "");

  const formatearIA = async () => {
    if (!iaTipo) return;
    if (!value.trim()) {
      setMsg({ tipo: "err", texto: "Escribe algo primero para que la IA tenga qué mejorar" });
      return;
    }
    setFormateando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cotizaciones/formatear-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: iaTipo,
          texto: value,
          contexto: iaContexto ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "err", texto: json.error || "Error IA" });
        return;
      }
      setValue(json.texto);
      setMsg({ tipo: "ok", texto: "Reformateado con IA — revisa antes de guardar" });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setFormateando(false);
    }
  };

  const guardar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      if (json.clickup_warning) {
        setMsg({ tipo: "warn", texto: `Guardado. ClickUp: ${json.clickup_warning}` });
      } else {
        setMsg({ tipo: "ok", texto: "Guardado" });
        setTimeout(() => setMsg(null), 2500);
      }
      router.refresh();
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="rounded-[12px] overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <h2 className="text-heading-2">{label}</h2>
        <div className="flex items-center gap-2">
          {iaTipo && (
            <button
              type="button"
              onClick={formatearIA}
              disabled={formateando || saving}
              className="btn-secondary btn-sm"
              title="La IA mejora la redacción manteniendo lo que escribiste"
            >
              <Sparkles size={14} strokeWidth={1.75} />
              <span>{formateando ? "Formateando…" : "Formatear con IA"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={!dirty || saving}
            className="btn-secondary btn-sm"
          >
            <Save size={14} strokeWidth={1.75} />
            <span>{saving ? "…" : dirty ? "Guardar" : "Sin cambios"}</span>
          </button>
        </div>
      </div>
      <div className="p-5 space-y-2">
        <textarea
          className="textarea"
          style={{ minHeight: rows * 24 + 24 }}
          rows={rows}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
        />
        {msg && (
          <p
            className="text-caption"
            style={{
              color:
                msg.tipo === "ok"
                  ? "var(--state-success)"
                  : msg.tipo === "warn"
                  ? "var(--state-warning)"
                  : "var(--state-error)",
            }}
          >
            {msg.tipo === "ok" ? "✓" : "⚠"} {msg.texto}
          </p>
        )}
      </div>
    </section>
  );
}
