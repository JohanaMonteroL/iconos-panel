"use client";

import { useMemo, useState } from "react";
import { Sparkles, Send } from "lucide-react";
import TareasTabla, { TareaRow, filaVacia } from "@/components/forms/TareasTabla";
import BufferSelector from "@/components/forms/BufferSelector";
import TotalesFlotantes from "@/components/forms/TotalesFlotantes";
import ResumenEstimacion from "@/components/forms/ResumenEstimacion";
import Modal from "@/components/ui/Modal";
import Markdown from "@/components/ui/Markdown";
import { totalesPERT, aplicarBuffer } from "@/lib/pert";

type Programador = { id: string; nombre: string };
type Proyecto = { id: string; nombre: string };

type Props = {
  programadores: Programador[];
  proyectos?: Proyecto[];
};

export default function EstimacionForm({ programadores, proyectos = [] }: Props) {
  const [programadorId, setProgramadorId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [rows, setRows] = useState<TareaRow[]>([filaVacia()]);
  const [bufferPct, setBufferPct] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [confirmAbierto, setConfirmAbierto] = useState(false);

  const [validando, setValidando] = useState(false);
  const [opinionIA, setOpinionIA] = useState<string | null>(null);
  const [opinionErr, setOpinionErr] = useState<string | null>(null);

  const totales = useMemo(
    () =>
      totalesPERT(
        rows.map((r) => ({
          hrs_min: Number(r.hrs_min) || 0,
          hrs_max: Number(r.hrs_max) || 0,
        }))
      ),
    [rows]
  );

  const totalesConBuffer = useMemo(
    () => aplicarBuffer(totales, bufferPct),
    [totales, bufferPct]
  );

  if (ok) {
    return (
      <div className="card text-center py-12 space-y-3">
        <div style={{ fontSize: 48 }}>✓</div>
        <h2 className="text-heading-1">Estimación enviada</h2>
        <p className="text-body text-text-secondary">
          Johana recibió tu estimación. No necesitas hacer nada más.
        </p>
      </div>
    );
  }

  const buildPayload = () => {
    const proyecto = proyectos.find((p) => p.id === proyectoId);
    return {
      programador_id: programadorId,
      nombre_solicitud: nombre.trim(),
      notas: notas.trim() || undefined,
      proyecto_clickup_id: proyectoId || undefined,
      proyecto_nombre: proyecto?.nombre,
      buffer_porcentaje: bufferPct,
      tareas: rows.map((r) => ({
        nombre: r.nombre.trim(),
        descripcion: r.descripcion.trim(),
        hrs_min: Number(r.hrs_min) || 0,
        hrs_max: Number(r.hrs_max) || 0,
      })),
    };
  };

  const validarConIA = async () => {
    setOpinionErr(null);
    setOpinionIA(null);
    if (!nombre.trim() || rows.length === 0) {
      setOpinionErr("Llena al menos el nombre y una tarea con horas.");
      return;
    }
    setValidando(true);
    try {
      const res = await fetch("/api/ia/validar-horas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (!res.ok) {
        setOpinionErr(json.error || "No se pudo consultar la IA.");
        return;
      }
      setOpinionIA(json.opinion);
    } catch {
      setOpinionErr("Error de red. Intenta de nuevo.");
    } finally {
      setValidando(false);
    }
  };

  // El submit del form abre el modal de confirmación (no envía aún)
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    // Validación mínima antes de abrir el modal
    const localErrors: Record<string, string> = {};
    if (!programadorId) localErrors.programador_id = "Selecciona un estimador.";
    if (!nombre.trim()) localErrors.nombre_solicitud = "Pon un nombre.";
    if (rows.length === 0) localErrors.tareas = "Añade al menos una tarea.";
    rows.forEach((r, i) => {
      if (!r.nombre.trim())
        localErrors[`tareas.${i}.nombre`] = "Falta el nombre.";
      const min = Number(r.hrs_min);
      const max = Number(r.hrs_max);
      if (!Number.isFinite(min) || min < 0)
        localErrors[`tareas.${i}.hrs_min`] = "Inválido.";
      if (!Number.isFinite(max) || max < 0)
        localErrors[`tareas.${i}.hrs_max`] = "Inválido.";
      if (Number.isFinite(min) && Number.isFinite(max) && max < min)
        localErrors[`tareas.${i}.hrs_max`] = "Máx debe ser ≥ Mín.";
    });
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setConfirmAbierto(true);
  };

  // Envío real, disparado desde el modal
  const enviar = async () => {
    setErrors({});
    setSending(true);
    try {
      const res = await fetch("/api/estimaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {};
        (json.errors ?? []).forEach((e: any) => (map[e.path] = e.message));
        setErrors(map);
        if (!json.errors) map.__form = json.error ?? "No se pudo enviar.";
        setConfirmAbierto(false);
        return;
      }
      setConfirmAbierto(false);
      setOk(true);
    } catch {
      setErrors({ __form: "Error de red. Intenta de nuevo." });
      setConfirmAbierto(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8 pb-32">
      {/* Bloque 1: Datos generales */}
      <section className="card space-y-5">
        <h2 className="text-heading-2">Datos generales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Estimador *</label>
            <select
              className="input"
              value={programadorId}
              onChange={(e) => setProgramadorId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {programadores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {errors.programador_id && (
              <span className="field-hint" style={{ color: "var(--state-error)" }}>
                {errors.programador_id}
              </span>
            )}
          </div>

          <div>
            <label className="field-label">
              Proyecto {proyectos.length === 0 && (
                <span className="text-text-tertiary font-normal">(sin ClickUp configurado)</span>
              )}
            </label>
            <select
              className="input"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              disabled={proyectos.length === 0}
            >
              <option value="">{proyectos.length === 0 ? "—" : "Selecciona un proyecto…"}</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <span className="field-hint">
              {proyectos.length > 0
                ? "Lista del campo personalizado de ClickUp"
                : "Cuando se configure ClickUp aparecerán los proyectos aquí"}
            </span>
          </div>

          <div className="md:col-span-2">
            <label className="field-label">Nombre de la cotización *</label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Soporte pasarela de pagos Pollo Loco"
            />
            {errors.nombre_solicitud && (
              <span className="field-hint" style={{ color: "var(--state-error)" }}>
                {errors.nombre_solicitud}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Bloque 2: Tareas */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-heading-2">Tareas y horas</h2>
          <span className="text-caption text-text-tertiary">
            El esperado se calcula automáticamente
          </span>
        </div>
        <TareasTabla rows={rows} onChange={setRows} errors={errors} />
        {errors.tareas && (
          <p className="text-caption text-center" style={{ color: "var(--state-error)" }}>
            {errors.tareas}
          </p>
        )}
      </section>

      {/* Bloque 3: Totales + Buffer */}
      <section className="card space-y-6">
        <h2 className="text-heading-2">Resumen</h2>

        <div>
          <div className="text-overline text-text-tertiary mb-3">Horas originales</div>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-caption text-text-tertiary">Mínimo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalMin}h
              </div>
            </div>
            <div
              className="text-center border-l border-r"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="text-caption text-text-tertiary">PERT esperado</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalEsperado}h
              </div>
            </div>
            <div className="text-center">
              <div className="text-caption text-text-tertiary">Máximo</div>
              <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 600 }}>
                {totales.totalMax}h
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-overline text-text-tertiary pt-4">Buffer adicional</div>
          <p className="text-caption text-text-secondary">
            Margen extra que se suma a tu estimación, para cubrir imprevistos.
          </p>
          <BufferSelector value={bufferPct} onChange={setBufferPct} />
        </div>

        {bufferPct > 0 && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="text-overline text-text-tertiary mb-3">
              Total con buffer (+{bufferPct}%)
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-caption text-text-tertiary">Mínimo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalMin}h
                </div>
              </div>
              <div
                className="text-center border-l border-r"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="text-caption text-text-tertiary">PERT esperado</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalEsperado}h
                </div>
              </div>
              <div className="text-center">
                <div className="text-caption text-text-tertiary">Máximo</div>
                <div className="mt-1 num-tabular" style={{ fontSize: 24, fontWeight: 700 }}>
                  {totalesConBuffer.totalMax}h
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-caption text-text-tertiary text-center">
          PERT esperado = (mín + máx) / 2 — punto medio del rango.
        </p>
      </section>

      {/* Bloque 4: Notas */}
      <section className="card">
        <label className="field-label">Notas generales</label>
        <span className="field-hint mb-2">Opcional — supuestos o advertencias globales</span>
        <textarea
          className="textarea min-h-[100px] mt-2"
          rows={4}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </section>

      {/* Bloque 5: Validación IA */}
      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-heading-2">¿Las horas tienen sentido?</h2>
            <p className="text-caption text-text-secondary mt-1">
              Pide a la IA una segunda opinión antes de enviar. No envía la estimación.
            </p>
          </div>
          <button
            type="button"
            onClick={validarConIA}
            disabled={validando}
            className="btn-secondary"
          >
            <Sparkles size={16} strokeWidth={1.75} />
            <span>{validando ? "Consultando…" : "Validar con IA"}</span>
          </button>
        </div>
        {opinionErr && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {opinionErr}
          </p>
        )}
        {opinionIA && (
          <div
            className="rounded-[10px] p-4 text-body"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            <Markdown text={opinionIA} />
          </div>
        )}
      </section>

      {/* Submit */}
      <div>
        {errors.__form && (
          <p
            className="text-caption text-center mb-3"
            style={{ color: "var(--state-error)" }}
          >
            {errors.__form}
          </p>
        )}
        <button type="submit" disabled={sending} className="btn-primary w-full">
          <Send size={16} strokeWidth={1.75} />
          <span>Revisar y enviar</span>
        </button>
        <p className="text-caption text-text-tertiary text-center mt-3">
          Te mostraremos un resumen antes de enviar. Una vez enviada no podrás editarla.
        </p>
      </div>

      <Modal
        open={confirmAbierto}
        onClose={() => !sending && setConfirmAbierto(false)}
        title="Confirmar envío"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmAbierto(false)}
              disabled={sending}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={sending}
              className="btn-primary"
            >
              <Send size={16} strokeWidth={1.75} />
              <span>{sending ? "Enviando…" : "Confirmar y enviar"}</span>
            </button>
          </>
        }
      >
        <ResumenEstimacion
          programador={
            programadores.find((p) => p.id === programadorId)?.nombre ?? "—"
          }
          proyecto={proyectos.find((p) => p.id === proyectoId)?.nombre}
          nombreSolicitud={nombre.trim()}
          notas={notas.trim() || undefined}
          tareas={rows.map((r) => ({
            nombre: r.nombre.trim(),
            descripcion: r.descripcion.trim(),
            hrs_min: Number(r.hrs_min) || 0,
            hrs_max: Number(r.hrs_max) || 0,
          }))}
          bufferPct={bufferPct}
          totales={totales}
          totalesConBuffer={totalesConBuffer}
        />
        {errors.__form && (
          <p
            className="text-caption mt-4 text-center"
            style={{ color: "var(--state-error)" }}
          >
            {errors.__form}
          </p>
        )}
      </Modal>

      <TotalesFlotantes
        numTareas={rows.length}
        totalMin={totales.totalMin}
        totalEsperado={totales.totalEsperado}
        totalMax={totales.totalMax}
        bufferPct={bufferPct}
        totalMinBuf={totalesConBuffer.totalMin}
        totalEsperadoBuf={totalesConBuffer.totalEsperado}
        totalMaxBuf={totalesConBuffer.totalMax}
      />
    </form>
  );
}
