"use client";

// Alta manual de un Cobro — sin pasar por una cotización. Desarrollo crea
// el Cobro + su primer Período (con el nombre capturado); Soporte agrega un Período al
// cobro de soporte del proyecto (ver POST /api/cobros). En ambos casos
// manda a Johana directo a la ficha del período, donde ya puede dividir en
// parcialidades, subir factura o registrar pagos.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, DollarSign, Clock, Code2, LifeBuoy } from "lucide-react";
import { tarifaSoporte } from "@/lib/cobros/calculos";
import Modal from "@/components/ui/Modal";
import CostoHoraField, { type Moneda } from "@/app/panel/proyectos/CostoHoraField";

type Proyecto = {
  id: string;
  nombre: string;
  emoji?: string | null;
  precio_hora_venta?: number | null;
  soporte_tarifa_hora?: number | null;
  moneda_hora?: Moneda;
};
type Programador = { id: string; nombre: string };

function fmtMoneda(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda || "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toLocaleString("es-MX")} ${moneda}`;
  }
}

export default function CrearCobroModal({
  proyectos,
  programadores,
}: {
  proyectos: Proyecto[];
  programadores: Programador[];
}) {
  const router = useRouter();

  // Fuerza una re-obtención del server component apenas se monta esta
  // página — el Router Cache del cliente a veces sirve una versión de
  // /panel/cobros de antes de que se creara un proyecto nuevo (aunque el
  // servidor ya lo tenga), dejando el catálogo de proyectos de este modal
  // desactualizado hasta refrescar a mano. `router.refresh()` es estable
  // (no depende de la config experimental de staleTimes).
  useEffect(() => {
    router.refresh();
    // Solo al montar — no queremos volver a refrescar en cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState<"desarrollo" | "soporte">("desarrollo");
  const [titulo, setTitulo] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [programadorId, setProgramadorId] = useState("");
  const [modo, setModo] = useState<"horas" | "monto">("horas");
  const [horas, setHoras] = useState("");
  const [montoDirecto, setMontoDirecto] = useState("");
  const [monedaDirecta, setMonedaDirecta] = useState<Moneda>("MXN");
  const [descripcion, setDescripcion] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const proyecto = proyectos.find((p) => p.id === proyectoId);
  // Soporte cobra con la tarifa de soporte del proyecto (o el costo/hora
  // general si no tiene), igual que el cron mensual.
  const precioHora = proyecto ? (origen === "soporte" ? tarifaSoporte(proyecto) : proyecto.precio_hora_venta ?? 0) : 0;
  const monedaHoras = proyecto?.moneda_hora ?? "MXN";
  const montoCalculado =
    modo === "horas" ? Math.round((Number(horas) || 0) * precioHora * 100) / 100 : Number(montoDirecto) || 0;

  const cerrar = () => {
    if (sending) return;
    setAbierto(false);
    setOrigen("desarrollo");
    setTitulo("");
    setProyectoId("");
    setProgramadorId("");
    setModo("horas");
    setHoras("");
    setMontoDirecto("");
    setMonedaDirecta("MXN");
    setDescripcion("");
    setErrors({});
  };

  const crear = async () => {
    setErrors({});
    const localErrors: Record<string, string> = {};
    if (!titulo.trim()) localErrors.titulo = "Pon un nombre para el cobro.";
    if (!proyectoId) localErrors.proyecto_id = "Selecciona un proyecto.";
    if (modo === "horas" && (!Number.isFinite(Number(horas)) || Number(horas) <= 0)) {
      localErrors.horas = "Captura las horas.";
    }
    if (modo === "monto" && (!Number.isFinite(Number(montoDirecto)) || Number(montoDirecto) <= 0)) {
      localErrors.monto = "Captura un monto.";
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/cobros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen,
          titulo: titulo.trim(),
          proyecto_id: proyectoId,
          programador_id: programadorId || undefined,
          descripcion: descripcion.trim() || undefined,
          horas: modo === "horas" ? Number(horas) : undefined,
          monto: modo === "monto" ? Number(montoDirecto) : undefined,
          moneda: modo === "monto" ? monedaDirecta : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {};
        (json.errors ?? []).forEach((e: any) => (map[e.path] = e.message));
        if (!json.errors) map.__form = json.error ?? "No se pudo crear el cobro.";
        setErrors(map);
        return;
      }
      router.push(`/panel/cobros/${json.periodoId}`);
    } catch {
      setErrors({ __form: "Error de red. Intenta de nuevo." });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          router.refresh();
          setAbierto(true);
        }}
        className="btn-primary"
      >
        <Plus size={16} strokeWidth={1.75} />
        <span>Crear cobro</span>
      </button>

      <Modal
        open={abierto}
        onClose={cerrar}
        title="Crear cobro"
        size="md"
        footer={
          <>
            <button type="button" onClick={cerrar} disabled={sending} className="btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={crear} disabled={sending} className="btn-primary">
              <Plus size={16} strokeWidth={1.75} />
              <span>{sending ? "Creando…" : "Crear cobro"}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-caption text-text-secondary">
            Para un cobro que no viene de una cotización — un trabajo extra, un ajuste, lo que
            sea. Se crea directo en &quot;Listo para cobrar&quot;; de ahí puedes dividirlo en
            parcialidades, subir factura y registrar pagos igual que cualquier otro Cobro.
          </p>

          <div>
            <label className="field-label">Tipo de cobro *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrigen("desarrollo")}
                className={origen === "desarrollo" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                aria-pressed={origen === "desarrollo"}
              >
                <Code2 size={14} strokeWidth={1.75} />
                <span>Desarrollo</span>
              </button>
              <button
                type="button"
                onClick={() => setOrigen("soporte")}
                className={origen === "soporte" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                aria-pressed={origen === "soporte"}
              >
                <LifeBuoy size={14} strokeWidth={1.75} />
                <span>Soporte</span>
              </button>
            </div>
            {origen === "soporte" && (
              <span className="field-hint block">
                Se agrega como un período al cobro de Soporte del proyecto (si aún no tiene uno, se
                crea), junto a los meses que genera el soporte automático.
              </span>
            )}
            {errors.origen && (
              <span className="field-hint block" style={{ color: "var(--state-error)" }}>
                {errors.origen}
              </span>
            )}
          </div>

          <div>
            <label className="field-label">Nombre del cobro *</label>
            <input
              className="input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Ajuste de servidor — septiembre"
              autoFocus
            />
            {errors.titulo && (
              <span className="field-hint" style={{ color: "var(--state-error)" }}>
                {errors.titulo}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Proyecto *</label>
              <select className="input" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                <option value="">Selecciona…</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji ? `${p.emoji} ` : ""}
                    {p.nombre}
                  </option>
                ))}
              </select>
              {errors.proyecto_id && (
                <span className="field-hint" style={{ color: "var(--state-error)" }}>
                  {errors.proyecto_id}
                </span>
              )}
            </div>
            <div>
              <label className="field-label">Programador</label>
              <select className="input" value={programadorId} onChange={(e) => setProgramadorId(e.target.value)}>
                <option value="">Sin asignar</option>
                {programadores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">¿Cómo capturas el monto?</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setModo("horas")}
                className={modo === "horas" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              >
                <Clock size={14} strokeWidth={1.75} />
                <span>Por horas</span>
              </button>
              <button
                type="button"
                onClick={() => setModo("monto")}
                className={modo === "monto" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              >
                <DollarSign size={14} strokeWidth={1.75} />
                <span>Monto directo</span>
              </button>
            </div>

            {modo === "horas" ? (
              <>
                <input
                  className="input num-tabular"
                  type="number"
                  min="0"
                  step="0.5"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder="0"
                />
                <span className="field-hint">
                  {proyecto
                    ? precioHora > 0
                      ? `${fmtMoneda(precioHora, monedaHoras)}/h${origen === "soporte" ? " (tarifa de soporte)" : ""} · total ${fmtMoneda(montoCalculado, monedaHoras)}`
                      : `"${proyecto.nombre}" no tiene costo por hora configurado — usa monto directo.`
                    : "Selecciona un proyecto para ver su costo por hora."}
                </span>
                {errors.horas && (
                  <span className="field-hint block" style={{ color: "var(--state-error)" }}>
                    {errors.horas}
                  </span>
                )}
              </>
            ) : (
              <>
                <CostoHoraField
                  valor={montoDirecto}
                  moneda={monedaDirecta}
                  onValorChange={setMontoDirecto}
                  onMonedaChange={setMonedaDirecta}
                />
                {errors.monto && (
                  <span className="field-hint" style={{ color: "var(--state-error)" }}>
                    {errors.monto}
                  </span>
                )}
              </>
            )}
          </div>

          <div>
            <label className="field-label">Descripción (opcional)</label>
            <textarea
              className="textarea"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué es este cobro, para qué fue, cualquier contexto útil"
            />
          </div>

          {errors.__form && (
            <p className="text-caption" style={{ color: "var(--state-error)" }}>
              {errors.__form}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
