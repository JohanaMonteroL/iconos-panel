"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Save, Sparkles, RotateCcw, X } from "lucide-react";
import SlackText from "@/components/ui/SlackText";

type Props = {
  cotizacionId: string;
  slackText: string;
  // Contexto opcional para alimentar a la IA.
  iaContexto?: string;
};

/**
 * Card del mensaje de Slack al jefe. Modo lectura por default, botón Editar
 * que despliega textarea + botón "Formatear con IA" + Guardar / Cancelar.
 * El texto se persiste vía POST /api/cotizaciones/[id]/slack-text.
 */
export default function SlackMessageEditor({
  cotizacionId,
  slackText,
  iaContexto,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slackText);
  const [saving, setSaving] = useState(false);
  const [formateando, setFormateando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn" | "err"; texto: string } | null>(
    null
  );

  useEffect(() => {
    setValue(slackText);
  }, [slackText]);

  const empezarEdit = () => {
    setValue(slackText);
    setEditing(true);
    setMsg(null);
  };

  const cancelar = () => {
    setValue(slackText);
    setEditing(false);
    setMsg(null);
  };

  const formatearConIA = async () => {
    if (!value.trim()) {
      setMsg({ tipo: "err", texto: "No hay texto que formatear" });
      return;
    }
    setFormateando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cotizaciones/formatear-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "slack_admin",
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
      setMsg({ tipo: "ok", texto: "Reformateado — revisa y guarda si te gusta" });
      setTimeout(() => setMsg(null), 3500);
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
      const res = await fetch(
        `/api/cotizaciones/${cotizacionId}/slack-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slack_text: value }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      setMsg({ tipo: "ok", texto: "Mensaje guardado" });
      setEditing(false);
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="rounded-[12px] border overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div
        className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <h2 className="text-heading-2">Mensaje al jefe</h2>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={empezarEdit}
              className="btn-secondary btn-sm"
            >
              <Edit3 size={14} strokeWidth={1.75} />
              <span>Editar texto</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={formatearConIA}
                disabled={formateando || saving}
                className="btn-secondary btn-sm"
              >
                <Sparkles size={14} strokeWidth={1.75} />
                <span>{formateando ? "Formateando…" : "Formatear con IA"}</span>
              </button>
              <button
                type="button"
                onClick={cancelar}
                disabled={saving}
                className="btn-ghost btn-sm"
              >
                <X size={14} strokeWidth={1.75} />
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={saving || value === slackText}
                className="btn-primary btn-sm"
              >
                <Save size={14} strokeWidth={1.75} />
                <span>{saving ? "Guardando…" : "Guardar"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5 space-y-2">
        {editing ? (
          <textarea
            className="textarea"
            style={{ minHeight: 320 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Texto en formato Slack mrkdwn..."
          />
        ) : (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              fontFamily: "Lato, ui-sans-serif, system-ui, sans-serif",
              lineHeight: 1.5,
            }}
          >
            <SlackText text={slackText} />
          </div>
        )}

        <p className="text-caption text-text-tertiary">
          Se regenera al cambiar horas/monto/tareas/Sherlyn. Si lo editas a
          mano, queda fijo hasta que vuelvas a darle <RotateCcw size={11} strokeWidth={1.75} className="inline -mt-0.5" /> Restaurar.
          Para reenviar con aviso de cambio usa “Notificar actualización al jefe”.
        </p>

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
