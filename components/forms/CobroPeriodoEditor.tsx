"use client";

// Acciones de un Período de Cobro — mismo patrón que CotizacionAcciones en
// CotizacionEditor.tsx: pill de color (estado-trigger) que abre un modal
// con un grid de chips (estado-chip) para moverlo a cualquiera de los 4
// estados, más el botón de borrado con ConfirmAccionModal.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2, Check, CheckCircle2, Plus, Pencil, Scissors } from "lucide-react";
import ConfirmAccionModal from "@/components/ui/ConfirmAccionModal";
import Modal from "@/components/ui/Modal";
import {
  ORDEN_FLUJO_COBRO_PERIODO,
  labelEstadoPeriodo,
  badgeEstadoPeriodo,
} from "@/lib/estados/cobros";

const MONEDAS_VALIDAS = ["MXN", "USD"] as const;

function fmtMonto(n: number, moneda: string): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PeriodoAcciones({
  periodoId,
  estado,
  etiqueta,
  monto,
  moneda,
  esUltimoPeriodo,
}: {
  periodoId: string;
  estado: string;
  etiqueta: string;
  monto: number;
  moneda: string;
  esUltimoPeriodo: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editarAbierto, setEditarAbierto] = useState(false);
  const [cambioAbierto, setCambioAbierto] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [modalEliminar, setModalEliminar] = useState(false);

  const cambiarEstado = async (nuevo: string) => {
    setWorking(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cobros/periodos/${periodoId}/cambiar-estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "No se pudo cambiar el estado");
        return;
      }
      setCambioAbierto(false);
      router.refresh();
    } catch {
      setMsg("Error de red");
    } finally {
      setWorking(false);
    }
  };

  const eliminar = async () => {
    const res = await fetch(`/api/cobros/periodos/${periodoId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "No se pudo eliminar el período");
    setModalEliminar(false);
    router.replace("/panel/cobros");
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-heading-2">Acciones</h2>
      <div className="flex flex-wrap gap-2.5">
        <button
          disabled={working}
          onClick={() => {
            setNuevoEstado("");
            setCambioAbierto(true);
          }}
          className={`estado-trigger ${badgeEstadoPeriodo(estado)}`}
          title="Mover este período a cualquier otro estado"
        >
          <span className="estado-trigger-dot" />
          <span>{labelEstadoPeriodo(estado)}</span>
          <ChevronDown size={14} strokeWidth={2.25} />
        </button>

        <button
          disabled={working}
          onClick={() => setEditarAbierto(true)}
          className="btn-secondary"
        >
          <Pencil size={16} strokeWidth={1.75} />
          <span>Editar</span>
        </button>

        <button
          disabled={working}
          onClick={() => setModalEliminar(true)}
          className="btn-secondary"
          style={{ color: "var(--state-error)" }}
        >
          <Trash2 size={16} strokeWidth={1.75} />
          <span>Eliminar período</span>
        </button>
      </div>
      {msg && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {msg}
        </p>
      )}

      <Modal
        open={cambioAbierto}
        onClose={() => !working && setCambioAbierto(false)}
        title="Cambiar estado del período"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCambioAbierto(false)}
              disabled={working}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!nuevoEstado || nuevoEstado === estado || working}
              onClick={() => cambiarEstado(nuevoEstado)}
              className="btn-primary"
            >
              <CheckCircle2 size={14} strokeWidth={1.75} />
              <span>
                {working ? "Aplicando…" : `Cambiar a "${labelEstadoPeriodo(nuevoEstado || estado)}"`}
              </span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-overline text-text-tertiary mb-1">Estado actual</div>
            <span className={`badge-lg ${badgeEstadoPeriodo(estado)}`}>
              <span className="badge-dot" />
              {labelEstadoPeriodo(estado)}
            </span>
          </div>

          <div>
            <label className="field-label">Nuevo estado *</label>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mt-1">
              {ORDEN_FLUJO_COBRO_PERIODO.map((e) => {
                const esActual = e === estado;
                const seleccionado = nuevoEstado === e;
                return (
                  <button
                    key={e}
                    type="button"
                    disabled={esActual}
                    onClick={() => setNuevoEstado(e)}
                    className={`estado-chip ${badgeEstadoPeriodo(e)} ${seleccionado ? "is-selected" : ""}`}
                    title={esActual ? "Estado actual" : `Cambiar a "${labelEstadoPeriodo(e)}"`}
                  >
                    {seleccionado && <Check size={13} strokeWidth={2.5} />}
                    <span>{labelEstadoPeriodo(e)}</span>
                  </button>
                );
              })}
            </div>
            <span className="field-hint">
              La factura (PDF/XML) es siempre opcional — nunca bloquea mover a &quot;Facturado&quot;.
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmAccionModal
        open={modalEliminar}
        onClose={() => setModalEliminar(false)}
        onConfirm={eliminar}
        titulo="Eliminar período"
        descripcion={
          esUltimoPeriodo ? (
            <>
              Este es el <strong>único período</strong> de este Cobro — al eliminarlo también se
              borrará el Cobro completo (junto con sus pagos registrados).
            </>
          ) : (
            <>
              Se eliminará este período y sus pagos registrados. El resto del Cobro (los demás
              períodos) no se ve afectado.
            </>
          )
        }
        palabraClave="eliminar"
        textoBoton="Eliminar período"
        peligroso
      />

      <EditarPeriodoModal
        periodoId={periodoId}
        etiquetaInicial={etiqueta}
        montoInicial={monto}
        monedaInicial={moneda}
        open={editarAbierto}
        onClose={() => setEditarAbierto(false)}
      />
    </section>
  );
}

function EditarPeriodoModal({
  periodoId,
  etiquetaInicial,
  montoInicial,
  monedaInicial,
  open,
  onClose,
}: {
  periodoId: string;
  etiquetaInicial: string;
  montoInicial: number;
  monedaInicial: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [etiqueta, setEtiqueta] = useState(etiquetaInicial);
  const [monto, setMonto] = useState(String(montoInicial));
  const [moneda, setMoneda] = useState(monedaInicial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEtiqueta(etiquetaInicial);
      setMonto(String(montoInicial));
      setMoneda(monedaInicial);
      setError(null);
    }
  }, [open, etiquetaInicial, montoInicial, monedaInicial]);

  const guardar = async () => {
    if (!etiqueta.trim()) {
      setError("La etiqueta no puede quedar vacía");
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      setError("Monto inválido");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cobros/periodos/${periodoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta: etiqueta.trim(), monto: montoNum, moneda }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo guardar");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Editar período"
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="field-label">Etiqueta *</label>
          <input
            className="input"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="field-label">Monto *</label>
            <input
              className="input num-tabular"
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Moneda</label>
            <select
              className="input"
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
            >
              {MONEDAS_VALIDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Agrega un período manual (parcialidad) a un Cobro existente — para
 * Desarrollo: el primer período ("Pago único") lo crea el efecto
 * secundario de cambiar-estado, y este formulario agrega los siguientes.
 */
export function AgregarPeriodoForm({
  cobroId,
  moneda,
}: {
  cobroId: string;
  moneda: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [etiqueta, setEtiqueta] = useState("");
  const [monto, setMonto] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agregar = async () => {
    if (!etiqueta.trim()) {
      setError("La etiqueta no puede quedar vacía");
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      setError("Monto inválido");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/cobros/${cobroId}/periodos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta: etiqueta.trim(), monto: montoNum, moneda }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo agregar el período");
        return;
      }
      setEtiqueta("");
      setMonto("");
      setAbierto(false);
      if (json.periodo?.id) {
        router.push(`/panel/cobros/${json.periodo.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Error de red");
    } finally {
      setWorking(false);
    }
  };

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-secondary btn-sm w-fit">
        <Plus size={14} strokeWidth={1.75} />
        <span>Agregar período (parcialidad)</span>
      </button>
    );
  }

  return (
    <div
      className="rounded-[10px] p-3 space-y-2.5"
      style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="field-label">Etiqueta *</label>
          <input
            className="input"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Ej: Parcialidad 2 de 3"
            autoFocus
          />
        </div>
        <div>
          <label className="field-label">Monto *</label>
          <input
            className="input num-tabular"
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={agregar} disabled={working} className="btn-primary btn-sm">
          {working ? "Guardando…" : "Agregar período"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          disabled={working}
          className="btn-ghost btn-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Divide el monto total del contrato en N parcialidades — partes iguales o
 * montos personalizados que deben sumar exactamente el total. Reemplaza
 * TODOS los períodos actuales del Cobro (el servidor rechaza la operación
 * si ya hay pagos o factura cargada en alguno).
 */
export function DividirParcialidadesForm({
  cobroId,
  montoTotal,
  moneda,
}: {
  cobroId: string;
  montoTotal: number;
  moneda: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [n, setN] = useState("2");
  const [modo, setModo] = useState<"igual" | "personalizado">("igual");
  const [montos, setMontos] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nNum = Math.max(1, Math.min(24, Math.round(Number(n)) || 0));

  function repartoIgual(total: number, partes: number): string[] {
    const base = Math.floor((total / partes) * 100) / 100;
    return Array.from({ length: partes }, (_, i) =>
      (i === partes - 1 ? Math.round((total - base * (partes - 1)) * 100) / 100 : base).toFixed(2)
    );
  }

  useEffect(() => {
    if (!abierto) return;
    setMontos(repartoIgual(montoTotal, nNum));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, nNum]);

  const sumaPersonalizada = montos.reduce((acc, m) => acc + (Number(m) || 0), 0);
  const diferencia = Math.round((montoTotal - sumaPersonalizada) * 100) / 100;
  const cuadra = Math.abs(diferencia) <= 0.01;

  const confirmar = async () => {
    if (modo === "personalizado" && !cuadra) {
      setError(`Los montos no cuadran con el total — faltan ${fmtMonto(diferencia, moneda)}.`);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/cobros/${cobroId}/dividir-parcialidades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          modo === "igual"
            ? { n: nNum, modo: "igual" }
            : { n: nNum, modo: "personalizado", montos: montos.map((m) => Number(m)) }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo dividir en parcialidades");
        return;
      }
      setAbierto(false);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setWorking(false);
    }
  };

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-secondary btn-sm w-fit">
        <Scissors size={14} strokeWidth={1.75} />
        <span>Dividir en parcialidades</span>
      </button>
    );
  }

  return (
    <div
      className="rounded-[10px] p-3 space-y-3"
      style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
    >
      <div>
        <label className="field-label">¿En cuántas parcialidades?</label>
        <input
          className="input num-tabular"
          type="number"
          min={1}
          max={24}
          step={1}
          value={n}
          onChange={(e) => setN(e.target.value)}
          style={{ maxWidth: 100 }}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModo("igual")}
          className={modo === "igual" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
        >
          Partes iguales
        </button>
        <button
          type="button"
          onClick={() => setModo("personalizado")}
          className={modo === "personalizado" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
        >
          Montos personalizados
        </button>
      </div>

      {modo === "igual" ? (
        <p className="text-caption text-text-secondary">
          Se crearán {nNum} períodos de {fmtMonto(Number(montos[0] ?? 0), moneda)} cada uno (total{" "}
          {fmtMonto(montoTotal, moneda)}).
        </p>
      ) : (
        <div className="space-y-2">
          {montos.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-caption text-text-secondary" style={{ width: 110, flexShrink: 0 }}>
                Parcialidad {i + 1}
              </span>
              <input
                className="input num-tabular"
                type="number"
                min="0"
                step="0.01"
                value={m}
                onChange={(e) =>
                  setMontos((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                }
              />
            </div>
          ))}
          <p
            className="text-caption"
            style={{ color: cuadra ? "var(--state-success)" : "var(--state-error)" }}
          >
            Suma: {fmtMonto(sumaPersonalizada, moneda)} de {fmtMonto(montoTotal, moneda)}
            {!cuadra && ` — faltan ${fmtMonto(diferencia, moneda)}`}
          </p>
        </div>
      )}

      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}

      <p className="field-hint">
        Esto reemplaza los períodos actuales de este Cobro — solo funciona si todavía no tienen
        pagos ni factura cargada.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={working || (modo === "personalizado" && !cuadra)}
          className="btn-primary btn-sm"
        >
          {working ? "Dividiendo…" : `Crear ${nNum} período${nNum === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          disabled={working}
          className="btn-ghost btn-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
