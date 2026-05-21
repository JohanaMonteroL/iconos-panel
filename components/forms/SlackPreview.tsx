"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Save,
  Edit3,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { buildSlackText } from "@/lib/slack/format";
import SlackText from "@/components/ui/SlackText";
import Modal from "@/components/ui/Modal";

type Tipo = "min" | "pert" | "max" | "custom";

type Props = {
  estimacionId: string;
  nombreCotizacion: string;
  proyecto: string | null;
  programador: string;
  bufferPct: number;
  totalMin: number;
  totalEsperado: number;
  totalMax: number;
  descripcionCorta: string;
  puntosClave: string[];
  notas?: string | null;
  envioInicial: { tipo: Tipo; custom?: number | null } | null;
  // Texto manual ya guardado (override) o null si va auto-generado
  slackTextOverride: string | null;
  // URL del ticket de ClickUp (si existe). Cuando se provee, el nombre
  // se renderiza como hipervínculo en el mensaje.
  clickupUrl?: string | null;
};

export default function SlackPreview({
  estimacionId,
  nombreCotizacion,
  proyecto,
  programador,
  bufferPct,
  totalMin,
  totalEsperado,
  totalMax,
  descripcionCorta,
  puntosClave,
  notas,
  envioInicial,
  slackTextOverride,
  clickupUrl,
}: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(true);
  const [tipo, setTipo] = useState<Tipo>(envioInicial?.tipo ?? "pert");
  const [custom, setCustom] = useState<string>(
    envioInicial?.tipo === "custom" && envioInicial.custom != null
      ? String(envioInicial.custom)
      : ""
  );
  const [dirtyEnvio, setDirtyEnvio] = useState(false);
  const [savingEnvio, setSavingEnvio] = useState(false);
  const [savedEnvio, setSavedEnvio] = useState<string | null>(null);

  // Estado del editor de texto
  const [modoEdit, setModoEdit] = useState(false);
  const [textoEdit, setTextoEdit] = useState<string>(slackTextOverride ?? "");
  const [savingTexto, setSavingTexto] = useState(false);
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);

  const horasEnvio = useMemo(() => {
    if (tipo === "min") return Math.round(totalMin * 10) / 10;
    if (tipo === "max") return Math.round(totalMax * 10) / 10;
    if (tipo === "pert") return Math.round(totalEsperado * 10) / 10;
    const n = Number(custom);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
  }, [tipo, totalMin, totalMax, totalEsperado, custom]);

  const textoGenerado = useMemo(
    () =>
      buildSlackText({
        nombreCotizacion,
        proyecto,
        programador,
        horasEnvio,
        bufferPct,
        descripcionCorta,
        puntosClave,
        notas,
        clickupUrl,
      }),
    [
      nombreCotizacion,
      proyecto,
      programador,
      horasEnvio,
      bufferPct,
      descripcionCorta,
      puntosClave,
      notas,
      clickupUrl,
    ]
  );

  // Texto efectivo: override si existe, sino generado
  const textoMostrado = slackTextOverride ?? textoGenerado;

  useEffect(() => {
    const initialTipo = envioInicial?.tipo ?? "pert";
    const initialCustom = envioInicial?.custom ?? null;
    const cambio =
      tipo !== initialTipo ||
      (tipo === "custom" && Number(custom) !== Number(initialCustom));
    setDirtyEnvio(cambio);
  }, [tipo, custom, envioInicial]);

  const guardarEnvio = async () => {
    setSavingEnvio(true);
    setSavedEnvio(null);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}/horas-envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          custom: tipo === "custom" ? Number(custom) || 0 : null,
          horas_envio: horasEnvio,
        }),
      });
      if (res.ok) {
        setSavedEnvio("Guardado");
        setDirtyEnvio(false);
        setTimeout(() => setSavedEnvio(null), 2000);
        router.refresh();
      }
    } finally {
      setSavingEnvio(false);
    }
  };

  const empezarEdit = () => {
    setTextoEdit(textoMostrado);
    setModoEdit(true);
  };

  const guardarTexto = async () => {
    setSavingTexto(true);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}/slack-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slack_text: textoEdit }),
      });
      if (res.ok) {
        setModoEdit(false);
        router.refresh();
      }
    } finally {
      setSavingTexto(false);
    }
  };

  const restaurarGenerado = async () => {
    setSavingTexto(true);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}/slack-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slack_text: "" }),
      });
      if (res.ok) {
        setModoEdit(false);
        setTextoEdit("");
        setConfirmandoRestaurar(false);
        router.refresh();
      }
    } finally {
      setSavingTexto(false);
    }
  };

  const tieneOverride = slackTextOverride !== null;

  return (
    <div
      className="rounded-[12px] border overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 border-b text-left"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={16} strokeWidth={1.75} className="text-text-secondary" />
          <span className="text-heading-2">Mensaje a Slack al jefe</span>
          {tieneOverride && !modoEdit && (
            <span className="badge badge-warning ml-2">Editado</span>
          )}
        </div>
        {abierto ? (
          <ChevronUp size={16} strokeWidth={1.75} className="text-text-tertiary" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.75} className="text-text-tertiary" />
        )}
      </button>

      {abierto && (
        <div className="p-5 space-y-4">
          {/* Selector de horas */}
          {!modoEdit && (
            <div className="space-y-2">
              <div className="text-overline text-text-tertiary">
                Horas que verá el jefe en el mensaje
              </div>
              <p className="text-caption text-text-secondary">
                Solo cambia el número de horas que aparece en este mensaje de Slack.
                No modifica las horas de cada tarea (ésas se editan arriba) ni el rango
                mín/máx que se manda a ClickUp.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {(["min", "pert", "max"] as Tipo[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`btn-sm whitespace-nowrap ${tipo === t ? "btn-primary" : "btn-secondary"}`}
                  >
                    {t === "min"
                      ? `Mín · ${totalMin}h`
                      : t === "pert"
                      ? `PERT · ${totalEsperado}h`
                      : `Máx · ${totalMax}h`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTipo("custom")}
                  className={`btn-sm whitespace-nowrap ${tipo === "custom" ? "btn-primary" : "btn-secondary"}`}
                >
                  Personalizado
                </button>
                {tipo === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="input input-sm num-tabular text-center w-24"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      placeholder="hrs"
                    />
                    <span className="text-caption text-text-secondary">horas</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 justify-end">
                {savedEnvio && (
                  <span
                    className="text-caption"
                    style={{ color: "var(--state-success)" }}
                  >
                    ✓ {savedEnvio}
                  </span>
                )}
                <button
                  type="button"
                  onClick={guardarEnvio}
                  disabled={savingEnvio || !dirtyEnvio}
                  className="btn-secondary btn-sm whitespace-nowrap"
                >
                  <Save size={14} strokeWidth={1.75} />
                  <span>{savingEnvio ? "…" : "Guardar horas"}</span>
                </button>
              </div>
              {tieneOverride && (
                <div
                  className="rounded-[10px] p-3 flex items-start gap-2 flex-wrap"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--state-warning)",
                  }}
                >
                  <AlertTriangle
                    size={16}
                    strokeWidth={1.75}
                    style={{ color: "var(--state-warning)", flexShrink: 0, marginTop: 2 }}
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-caption text-text-secondary">
                      El texto del mensaje está editado manualmente. Los cambios de buffer
                      y horas no se reflejan hasta que regeneres.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmandoRestaurar(true)}
                      className="btn-secondary btn-sm"
                    >
                      <RotateCcw size={14} strokeWidth={1.75} />
                      <span>Regenerar con valores actuales</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview / editor */}
          <div
            className="space-y-2 pt-2 border-t"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center justify-between pt-3">
              <div className="text-overline text-text-tertiary">
                {modoEdit ? "Editando texto" : "Vista previa"}
              </div>
              <div className="flex items-center gap-2">
                {!modoEdit && (
                  <button onClick={empezarEdit} className="btn-secondary btn-sm">
                    <Edit3 size={14} strokeWidth={1.75} />
                    <span>Editar texto</span>
                  </button>
                )}
                {!modoEdit && tieneOverride && (
                  <button
                    onClick={() => setConfirmandoRestaurar(true)}
                    disabled={savingTexto}
                    className="btn-ghost btn-sm"
                    title="Volver al mensaje auto-generado"
                  >
                    <RotateCcw size={14} strokeWidth={1.75} />
                    <span>Restaurar</span>
                  </button>
                )}
                {modoEdit && (
                  <>
                    <button
                      onClick={() => {
                        setModoEdit(false);
                        setTextoEdit(slackTextOverride ?? "");
                      }}
                      className="btn-ghost btn-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarTexto}
                      disabled={savingTexto}
                      className="btn-primary btn-sm"
                    >
                      <Save size={14} strokeWidth={1.75} />
                      <span>{savingTexto ? "…" : "Guardar texto"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {modoEdit ? (
              <textarea
                className="textarea min-h-[260px]"
                value={textoEdit}
                onChange={(e) => setTextoEdit(e.target.value)}
                style={{
                  fontFamily:
                    "Lato, ui-sans-serif, system-ui, sans-serif",
                  lineHeight: 1.5,
                }}
              />
            ) : (
              <div
                className="rounded-[10px] p-4 text-body"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  fontFamily:
                    "Lato, ui-sans-serif, system-ui, sans-serif",
                  lineHeight: 1.5,
                }}
              >
                <SlackText text={textoMostrado} />
              </div>
            )}

            {!clickupUrl && (
              <p className="text-caption text-text-tertiary">
                El nombre se convertirá en hipervínculo al ticket de ClickUp cuando se cree la
                cotización.
              </p>
            )}
            <p className="text-caption text-text-tertiary">
              El envío real a Slack se conectará en la siguiente iteración.
            </p>
          </div>
        </div>
      )}

      <Modal
        open={confirmandoRestaurar}
        onClose={() => !savingTexto && setConfirmandoRestaurar(false)}
        title="Restaurar mensaje generado"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmandoRestaurar(false)}
              disabled={savingTexto}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={restaurarGenerado}
              disabled={savingTexto}
              className="btn-primary"
            >
              <RotateCcw size={14} strokeWidth={1.75} />
              <span>{savingTexto ? "Restaurando…" : "Sí, restaurar"}</span>
            </button>
          </>
        }
      >
        <div className="flex gap-3">
          <AlertTriangle
            size={20}
            strokeWidth={1.75}
            style={{ color: "var(--state-warning)", flexShrink: 0, marginTop: 2 }}
          />
          <div className="space-y-2">
            <p className="text-body">
              Tu edición manual del mensaje se va a perder y se generará uno nuevo a partir
              de los datos actuales (buffer, horas y tareas).
            </p>
            <p className="text-caption text-text-secondary">
              Esto no se puede deshacer.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
