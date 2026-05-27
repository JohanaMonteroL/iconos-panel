"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Save } from "lucide-react";
import ProyectoSearch from "@/components/forms/ProyectoSearch";

type Proyecto = { id: string; nombre: string };

type Props = {
  cotizacionId: string;
  proyectos: Proyecto[];
  proyectoIdInicial: string | null;
  proyectoNombreInicial: string | null;
};

export default function ProyectoEditor({
  cotizacionId,
  proyectos,
  proyectoIdInicial,
  proyectoNombreInicial,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState<string>(proyectoIdInicial ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn" | "err"; texto: string } | null>(
    null
  );

  useEffect(() => {
    setValue(proyectoIdInicial ?? "");
  }, [proyectoIdInicial]);

  const dirty = (value || null) !== (proyectoIdInicial || null);

  const guardar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const sel = proyectos.find((p) => p.id === value) ?? null;
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyecto_clickup_id: sel?.id ?? null,
          proyecto_nombre: sel?.nombre ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "err", texto: json.error || "No se pudo guardar" });
        return;
      }
      if (json.clickup_warning) {
        setMsg({ tipo: "warn", texto: `Guardado. ClickUp: ${json.clickup_warning}` });
      } else {
        setMsg({ tipo: "ok", texto: "Proyecto actualizado y ClickUp sincronizado" });
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
        <div className="flex items-center gap-2">
          <FolderKanban size={16} strokeWidth={1.75} className="text-text-secondary" />
          <h2 className="text-heading-2">Proyecto</h2>
        </div>
        <span className="text-caption text-text-secondary">
          Actual:{" "}
          <strong className="text-text-primary font-semibold">
            {proyectoNombreInicial ?? "(sin proyecto)"}
          </strong>
        </span>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-caption text-text-secondary">
          Cambiar el proyecto también actualiza el campo &quot;Proyecto&quot; del ticket
          en ClickUp.
        </p>
        {proyectos.length === 0 ? (
          <p className="text-caption text-text-tertiary">
            Sin proyectos disponibles. Verifica la configuración de ClickUp.
          </p>
        ) : (
          <ProyectoSearch
            proyectos={proyectos}
            value={value}
            onChange={setValue}
          />
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={saving || !dirty}
            className="btn-primary btn-sm"
          >
            <Save size={14} strokeWidth={1.75} />
            <span>{saving ? "Guardando…" : dirty ? "Guardar" : "Sin cambios"}</span>
          </button>
        </div>

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
