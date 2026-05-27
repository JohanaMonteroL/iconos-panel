"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import ConceptosEditor, {
  totalConceptos,
  type Concepto,
} from "@/components/forms/ConceptosEditor";
import ProyectoSearch from "@/components/forms/ProyectoSearch";

type Proyecto = { id: string; nombre: string };

type Props = {
  programadores: { id: string; nombre: string }[];
  proyectos?: Proyecto[];
};

export default function NuevaCotizacionFijaForm({
  programadores,
  proyectos = [],
}: Props) {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [conceptos, setConceptos] = useState<Concepto[]>([
    { concepto: "", cantidad: 1, precio_unitario: 0 },
  ]);
  const [programadorId, setProgramadorId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [borradorCorreo, setBorradorCorreo] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // IA por campo
  const [iaCargando, setIaCargando] = useState<null | "descripcion" | "correo">(
    null
  );
  const [iaError, setIaError] = useState<string | null>(null);

  const montoNum = totalConceptos(conceptos);
  const conceptosValidos = conceptos.filter(
    (c) => c.concepto.trim().length > 0 && c.cantidad > 0 && c.precio_unitario >= 0
  );

  const puedeEnviar =
    nombre.trim().length > 0 && montoNum > 0 && conceptosValidos.length > 0;

  const formatearConIA = async (campo: "descripcion" | "correo") => {
    const texto = campo === "descripcion" ? descripcion : borradorCorreo;
    if (!texto.trim()) {
      setIaError(
        campo === "descripcion"
          ? "Escribe una descripción antes de formatear con IA"
          : "Escribe el borrador antes de formatear con IA"
      );
      return;
    }
    setIaCargando(campo);
    setIaError(null);
    try {
      const resumenConceptos = conceptosValidos
        .map(
          (c) =>
            `${c.cantidad}× ${c.concepto} ($${Number(c.precio_unitario).toLocaleString("es-MX")} c/u)`
        )
        .join(" · ");
      const ctx = `Cotización: ${nombre || "(sin nombre)"} · Total: $${
        montoNum > 0 ? montoNum.toLocaleString("es-MX") : "(sin monto)"
      } MXN${resumenConceptos ? ` · Conceptos: ${resumenConceptos}` : ""}`;

      const res = await fetch("/api/cotizaciones/formatear-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: campo === "descripcion" ? "sherlyn" : "correo",
          texto,
          contexto: ctx,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIaError(json.error || "Error consultando IA");
        return;
      }
      if (campo === "descripcion") setDescripcion(json.texto);
      else setBorradorCorreo(json.texto);
    } catch {
      setIaError("Error de red");
    } finally {
      setIaCargando(null);
    }
  };

  const enviar = async () => {
    setError(null);
    setWarnings([]);
    setEnviando(true);
    try {
      const proyectoSel = proyectos.find((p) => p.id === proyectoId);
      const res = await fetch("/api/cotizaciones/extraordinaria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          conceptos: conceptosValidos.map((c) => ({
            concepto: c.concepto.trim(),
            cantidad: Number(c.cantidad) || 0,
            precio_unitario: Number(c.precio_unitario) || 0,
          })),
          programador_id: programadorId || null,
          proyecto_clickup_id: proyectoSel?.id || null,
          proyecto_nombre: proyectoSel?.nombre || null,
          descripcion_corta: descripcion.trim(),
          borrador_correo: borradorCorreo.trim() || null,
          notas: notas.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al crear la cotización");
        return;
      }

      const ws: string[] = [];
      if (json.clickup_warning) ws.push(`ClickUp: ${json.clickup_warning}`);
      if (json.slack_warning) ws.push(`Slack: ${json.slack_warning}`);

      if (ws.length > 0) {
        setWarnings(ws);
        // Le damos unos segundos para que vea los warnings antes de redirigir.
        setTimeout(() => {
          router.push(`/panel/cotizaciones/${json.id}`);
          router.refresh();
        }, 2500);
      } else {
        router.push(`/panel/cotizaciones/${json.id}`);
        router.refresh();
      }
    } catch {
      setError("Error de red");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (puedeEnviar && !enviando) enviar();
      }}
      className="space-y-6"
    >
      {/* Datos generales */}
      <section className="card space-y-4">
        <h2 className="text-heading-2">Datos generales</h2>
        <div>
          <label className="field-label">Nombre de la cotización *</label>
          <input
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Venta de dispositivo X para cliente Y"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">
              Proyecto {proyectos.length === 0 && (
                <span className="text-text-tertiary font-normal">
                  (sin ClickUp configurado)
                </span>
              )}
            </label>
            <ProyectoSearch
              proyectos={proyectos}
              value={proyectoId}
              onChange={setProyectoId}
              disabled={proyectos.length === 0}
            />
            <span className="field-hint">
              {proyectos.length > 0
                ? `${proyectos.length} proyectos en ClickUp — escribe para filtrar`
                : "Cuando se configure ClickUp aparecerán aquí"}
            </span>
          </div>

          <div>
            <label className="field-label">Atendido por (opcional)</label>
            <select
              className="input"
              value={programadorId}
              onChange={(e) => setProgramadorId(e.target.value)}
            >
              <option value="">—</option>
              {programadores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Solo para tracking interno y para el campo Programador del ticket
              de ClickUp.
            </span>
          </div>
        </div>
      </section>

      {/* Conceptos */}
      <section className="card space-y-4">
        <h2 className="text-heading-2">Conceptos</h2>
        <p className="text-caption text-text-secondary">
          Agrega uno o varios productos / servicios. Cada concepto se factura
          con cantidad × precio unitario. El total se calcula solo.
        </p>
        <ConceptosEditor conceptos={conceptos} onChange={setConceptos} />
      </section>

      {/* Descripción para Slack / Sherlyn — opcional */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-heading-2">Detalle adicional (opcional)</h2>
          <button
            type="button"
            onClick={() => formatearConIA("descripcion")}
            disabled={iaCargando !== null}
            className="btn-secondary btn-sm"
          >
            <Sparkles size={14} strokeWidth={1.75} />
            <span>{iaCargando === "descripcion" ? "Formateando…" : "Formatear con IA"}</span>
          </button>
        </div>
        <p className="text-caption text-text-secondary">
          Notas sobre la cotización que NO son items de la lista — plazos,
          condiciones de entrega, supuestos. Aparece debajo de los conceptos
          en el ticket y en el mensaje al jefe.
        </p>
        <textarea
          className="textarea min-h-[100px]"
          rows={4}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej. Entrega: 1 semana. Incluye instalación y 6 meses de soporte."
        />
      </section>

      {/* Borrador correo */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-heading-2">Borrador de correo al cliente (opcional)</h2>
          <button
            type="button"
            onClick={() => formatearConIA("correo")}
            disabled={iaCargando !== null}
            className="btn-secondary btn-sm"
          >
            <Sparkles size={14} strokeWidth={1.75} />
            <span>{iaCargando === "correo" ? "Formateando…" : "Formatear con IA"}</span>
          </button>
        </div>
        <p className="text-caption text-text-secondary">
          Cuerpo del correo que Sherlyn mandará al cliente. Puedes dejarlo en
          blanco y editarlo después desde la cotización.
        </p>
        <textarea
          className="textarea min-h-[140px]"
          rows={6}
          value={borradorCorreo}
          onChange={(e) => setBorradorCorreo(e.target.value)}
          placeholder="Hola [nombre], te paso la cotización por el dispositivo solicitado…"
        />
      </section>

      {iaError && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          ⚠ {iaError}
        </p>
      )}

      {/* Notas */}
      <section className="card">
        <label className="field-label">Notas internas (opcional)</label>
        <input
          className="input"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej. Cliente urgente, validar disponibilidad antes de confirmar"
        />
      </section>

      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
      {warnings.map((w, i) => (
        <p
          key={i}
          className="text-caption"
          style={{ color: "var(--state-warning)" }}
        >
          ⚠ {w}
        </p>
      ))}

      <div className="sticky bottom-4 pt-4 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={!puedeEnviar || enviando}
          className="btn-primary"
        >
          <Send size={16} strokeWidth={1.75} />
          <span>{enviando ? "Creando…" : "Crear y mandar al jefe"}</span>
        </button>
      </div>
    </form>
  );
}
