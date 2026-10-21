"use client";

// Alta/edición de un Pago — ficha de referencia para copiar al ejecutar un
// pago a un proveedor externo (SUA, etc.), no un flujo con estados. Un solo
// modal para crear y editar: si recibe `pago`, edita esa fila (PATCH);
// si no, crea una nueva (POST). IVA es un porcentaje (ej. 16), no un monto —
// el total se autocalcula como monto + (monto × IVA%), igual que en una
// factura real, pero queda editable a mano si hace falta.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit3 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import MoneyInput from "@/components/ui/MoneyInput";
import PercentInput from "@/components/ui/PercentInput";
import { toast } from "@/lib/toast";
import type { Pago, Periodicidad, FormaPago, TipoPago, ComprobanteTipo } from "@/types/db";
import {
  PERIODICIDADES,
  PERIODICIDAD_LABEL,
  TIPOS_PAGO,
  TIPO_PAGO_LABEL,
  COMPROBANTE_TIPOS,
  COMPROBANTE_TIPO_LABEL,
} from "@/lib/pagos/labels";
import { formatearClabe, soloDigitos, tipoClabe } from "@/lib/pagos/clabe";
import { esCorreoValido } from "@/lib/pagos/validacion";
import { calcularTotal } from "@/lib/pagos/calculos";

function num(v: string): number {
  return Number(v.replace(/,/g, "")) || 0;
}

export default function PagoFormModal({ pago }: { pago?: Pago }) {
  const router = useRouter();
  const editMode = !!pago;

  const [abierto, setAbierto] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [nombrePago, setNombrePago] = useState(pago?.nombre_pago ?? "");
  const [empresaContacto, setEmpresaContacto] = useState(pago?.empresa_contacto ?? "");
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(pago?.periodicidad ?? "mensual");
  const [monto, setMonto] = useState(pago ? String(pago.monto) : "");
  const [iva, setIva] = useState(pago ? String(pago.iva) : "");
  const [totalAPagar, setTotalAPagar] = useState(pago ? String(pago.total_a_pagar) : "");
  const [totalTocado, setTotalTocado] = useState(editMode);
  const [formaPago, setFormaPago] = useState<FormaPago>(pago?.forma_pago ?? "manual");
  const [tipoPago, setTipoPago] = useState<TipoPago | "">(pago?.tipo_pago ?? "");
  const [bancoOCuenta, setBancoOCuenta] = useState(pago?.banco_o_cuenta ? formatearClabe(pago.banco_o_cuenta) : "");
  const [titular, setTitular] = useState(pago?.titular ?? "");
  const [correoComprobante, setCorreoComprobante] = useState(pago?.correo_comprobante ?? "");
  const [comprobanteTipo, setComprobanteTipo] = useState<ComprobanteTipo>(pago?.comprobante_tipo ?? "no_aplica");
  const [referencia, setReferencia] = useState(pago?.referencia ?? "");
  const [notas, setNotas] = useState(pago?.notas ?? "");

  const abrir = () => {
    setErrors({});
    if (!editMode) {
      setNombrePago("");
      setEmpresaContacto("");
      setPeriodicidad("mensual");
      setMonto("");
      setIva("");
      setTotalAPagar("");
      setTotalTocado(false);
      setFormaPago("manual");
      setTipoPago("");
      setBancoOCuenta("");
      setTitular("");
      setCorreoComprobante("");
      setComprobanteTipo("no_aplica");
      setReferencia("");
      setNotas("");
    }
    setAbierto(true);
  };

  const cerrar = () => {
    if (sending) return;
    setAbierto(false);
  };

  const onMontoChange = (v: string) => {
    setMonto(v);
    if (!totalTocado) setTotalAPagar(String(calcularTotal(num(v), num(iva))));
  };
  const onIvaChange = (v: string) => {
    setIva(v);
    if (!totalTocado) setTotalAPagar(String(calcularTotal(num(monto), num(v))));
  };

  const guardar = async () => {
    setErrors({});
    const localErrors: Record<string, string> = {};
    if (!nombrePago.trim()) localErrors.nombre_pago = "Pon un nombre para el pago.";
    if (correoComprobante.trim() && !esCorreoValido(correoComprobante)) {
      localErrors.correo_comprobante = "Ese correo no se ve válido.";
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setSending(true);
    try {
      const body = {
        nombre_pago: nombrePago.trim(),
        empresa_contacto: empresaContacto.trim() || null,
        periodicidad,
        monto: num(monto),
        iva: num(iva),
        total_a_pagar: num(totalAPagar),
        forma_pago: formaPago,
        tipo_pago: tipoPago || null,
        banco_o_cuenta: soloDigitos(bancoOCuenta) || null,
        titular: titular.trim() || null,
        correo_comprobante: correoComprobante.trim() || null,
        comprobante_tipo: comprobanteTipo,
        referencia: referencia.trim() || null,
        notas: notas.trim() || null,
      };
      const res = await fetch(editMode ? `/api/pagos/${pago!.id}` : "/api/pagos", {
        method: editMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {};
        (json.errors ?? []).forEach((e: any) => (map[e.path] = e.message));
        if (!json.errors) map.__form = json.error ?? "No se pudo guardar el pago.";
        setErrors(map);
        return;
      }
      setAbierto(false);
      toast(editMode ? "Pago actualizado" : "Pago creado");
      router.refresh();
    } catch {
      setErrors({ __form: "Error de red. Intenta de nuevo." });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={abrir} className={editMode ? "btn-secondary" : "btn-primary"}>
        {editMode ? <Edit3 size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
        <span>{editMode ? "Editar" : "Nuevo pago"}</span>
      </button>

      <Modal
        open={abierto}
        onClose={cerrar}
        title={editMode ? "Editar pago" : "Nuevo pago"}
        size="lg"
        footer={
          <>
            <button type="button" onClick={cerrar} disabled={sending} className="btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={sending} className="btn-primary">
              <Plus size={16} strokeWidth={1.75} />
              <span>{sending ? "Guardando…" : editMode ? "Guardar cambios" : "Crear pago"}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Nombre del pago *</label>
              <input
                className="input"
                value={nombrePago}
                onChange={(e) => setNombrePago(e.target.value)}
                placeholder="Ej. SUA"
                autoFocus
              />
              {errors.nombre_pago && (
                <span className="field-hint" style={{ color: "var(--state-error)" }}>
                  {errors.nombre_pago}
                </span>
              )}
            </div>
            <div>
              <label className="field-label">Empresa o contacto</label>
              <input
                className="input"
                value={empresaContacto}
                onChange={(e) => setEmpresaContacto(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <p className="field-hint">
            Los montos se capturan en pesos mexicanos (MXN) — por ahora no hay pagos en dólares,
            pero si algún día lo necesitas lo agregamos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="field-label">Periodicidad</label>
              <select
                className="input"
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)}
              >
                {PERIODICIDADES.map((p) => (
                  <option key={p} value={p}>
                    {PERIODICIDAD_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Monto</label>
              <MoneyInput value={monto} onChange={onMontoChange} />
            </div>
            <div>
              <label className="field-label">IVA (%)</label>
              <PercentInput value={iva} onChange={onIvaChange} />
            </div>
          </div>

          <div>
            <label className="field-label">Total a pagar</label>
            <MoneyInput
              value={totalAPagar}
              onChange={(v) => {
                setTotalTocado(true);
                setTotalAPagar(v);
              }}
            />
            <span className="field-hint">Se autocalcula como monto + IVA (%); puedes ajustarlo a mano.</span>
          </div>

          <div>
            <label className="field-label">Forma de pago</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormaPago("automatica")}
                className={formaPago === "automatica" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                aria-pressed={formaPago === "automatica"}
              >
                Automática
              </button>
              <button
                type="button"
                onClick={() => setFormaPago("manual")}
                className={formaPago === "manual" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                aria-pressed={formaPago === "manual"}
              >
                Manual
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Tipo de pago</label>
              <select className="input" value={tipoPago} onChange={(e) => setTipoPago(e.target.value as TipoPago)}>
                <option value="">Sin especificar</option>
                {TIPOS_PAGO.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_PAGO_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Comprobante a solicitar</label>
              <select
                className="input"
                value={comprobanteTipo}
                onChange={(e) => setComprobanteTipo(e.target.value as ComprobanteTipo)}
              >
                {COMPROBANTE_TIPOS.map((c) => (
                  <option key={c} value={c}>
                    {COMPROBANTE_TIPO_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Banco / clave o cuenta</label>
              <input
                className="input num-tabular"
                value={bancoOCuenta}
                onChange={(e) => setBancoOCuenta(formatearClabe(e.target.value))}
                placeholder="CLABE, cuenta o tarjeta"
                inputMode="numeric"
              />
              <span className="field-hint">{tipoClabe(bancoOCuenta) ?? "Se agrupa de 4 en 4 para que sea fácil de leer."}</span>
            </div>
            <div>
              <label className="field-label">Nombre de la cuenta (titular)</label>
              <input className="input" value={titular} onChange={(e) => setTitular(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Correo para enviar comprobante</label>
              <input
                className="input"
                type="email"
                value={correoComprobante}
                onChange={(e) => setCorreoComprobante(e.target.value)}
              />
              {errors.correo_comprobante && (
                <span className="field-hint" style={{ color: "var(--state-error)" }}>
                  {errors.correo_comprobante}
                </span>
              )}
            </div>
            <div>
              <label className="field-label">Referencia</label>
              <input className="input" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Notas</label>
            <textarea
              className="textarea"
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones, contexto, lo que haga falta recordar"
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
