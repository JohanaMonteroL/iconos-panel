"use client";

// Vista de Pagos + Documentos del detalle de un Período — sin pestañas: lo
// primero que se ve es a qué parcialidad corresponde este pago y su
// resumen (monto/pagado/pendiente), luego el formulario para registrar un
// pago, la lista de pagos de este período, un resumen de TODOS los pagos
// del contrato (los demás períodos hermanos, para no perder de vista el
// "ticket principal"), y hasta abajo la factura PDF/XML como complemento
// opcional del pago — reusa el diseño de tarjeta de adjunto de
// EnvioDetalle.tsx (icono + nombre + "Ver documento en pestaña nueva",
// target="_blank", sin iframe).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  FileCode2,
  ExternalLink,
  Trash2,
  UploadCloud,
  DollarSign,
  CheckCircle2,
  Receipt,
  Paperclip,
  X,
} from "lucide-react";
import { formatFechaLarga, formatFechaCorta } from "@/lib/dates";

type Pago = {
  id: string;
  monto: number;
  fecha: string;
  notas: string | null;
  comprobante_url: string | null;
};

type PagoContrato = {
  id: string;
  monto: number;
  fecha: string;
  periodoId: string;
  periodoEtiqueta: string;
  esPeriodoActual: boolean;
};

type Props = {
  periodoId: string;
  periodoEtiqueta: string;
  estado: string;
  montoPeriodo: number;
  moneda: string;
  facturaPdfUrl: string | null;
  facturaPdfNombre: string | null;
  facturaXmlUrl: string | null;
  facturaXmlNombre: string | null;
  pagos: Pago[];
  pagosContrato: PagoContrato[];
  mostrarLedgerContrato: boolean;
};

function fmtMonto(n: number, moneda: string): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AdjuntoFactura({
  periodoId,
  tipo,
  url,
  nombre,
}: {
  periodoId: string;
  tipo: "pdf" | "xml";
  url: string | null;
  nombre: string | null;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `factura-${tipo}-${periodoId}`;

  const subir = async (file: File) => {
    setWorking(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("tipo", tipo);
      form.append("file", file);
      const res = await fetch(`/api/cobros/periodos/${periodoId}/factura`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo subir el archivo");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setWorking(false);
    }
  };

  const quitar = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/cobros/periodos/${periodoId}/factura?tipo=${tipo}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo quitar el archivo");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setWorking(false);
    }
  };

  const Icono = tipo === "pdf" ? FileText : FileCode2;
  const colorFondo = tipo === "pdf" ? "#FEE2E2" : "#DBEAFE";
  const colorTexto = tipo === "pdf" ? "#DC2626" : "#2563EB";

  return (
    <section
      className="rounded-[12px] overflow-hidden"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
    >
      <div
        className="px-5 py-3 border-b flex items-center gap-2"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <Icono size={16} strokeWidth={1.75} className="text-text-secondary" />
        <h3 className="text-heading-2" style={{ fontSize: 15 }}>
          Factura {tipo.toUpperCase()}
        </h3>
      </div>
      <div className="p-5 space-y-3">
        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-[10px] p-3 transition-colors hover:bg-[var(--bg-surface)]"
              style={{ border: "1px solid var(--border-subtle)", textDecoration: "none" }}
            >
              <span
                className="flex items-center justify-center rounded-[8px] shrink-0"
                style={{ width: 40, height: 40, background: colorFondo, color: colorTexto }}
              >
                <Icono size={18} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-medium truncate">
                  {nombre ?? `factura.${tipo}`}
                </span>
                <span className="block text-caption text-text-tertiary">
                  {tipo.toUpperCase()} · Ver documento en pestaña nueva
                </span>
              </span>
              <ExternalLink size={16} strokeWidth={1.75} className="text-text-tertiary shrink-0" />
            </a>
            <button
              type="button"
              onClick={quitar}
              disabled={working}
              className="btn-secondary btn-sm"
              style={{ color: "var(--state-error)" }}
            >
              <Trash2 size={14} strokeWidth={1.75} />
              <span>{working ? "Quitando…" : "Quitar"}</span>
            </button>
          </>
        ) : (
          <>
            <p className="text-caption text-text-tertiary">
              Sin {tipo.toUpperCase()} cargado — es opcional, solo informativo.
            </p>
            <label htmlFor={inputId} className="btn-secondary btn-sm cursor-pointer inline-flex w-fit">
              <UploadCloud size={14} strokeWidth={1.75} />
              <span>{working ? "Subiendo…" : `Subir ${tipo.toUpperCase()}`}</span>
            </label>
            <input
              id={inputId}
              type="file"
              accept={tipo === "pdf" ? "application/pdf" : ".xml,application/xml,text/xml"}
              className="hidden"
              disabled={working}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) subir(file);
              }}
            />
          </>
        )}
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function ComprobanteCampo({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputId = "pago-comprobante";
  return (
    <div>
      <label className="field-label">Comprobante (opcional)</label>
      {file ? (
        <div
          className="flex items-center gap-3 rounded-[10px] p-2.5"
          style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <span
            className="flex items-center justify-center rounded-[8px] shrink-0"
            style={{ width: 32, height: 32, background: "#DCFCE7", color: "#16A34A" }}
          >
            <Paperclip size={15} strokeWidth={1.75} />
          </span>
          <span className="text-caption truncate flex-1 min-w-0">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-icon btn-ghost shrink-0"
            style={{ width: 26, height: 26 }}
            aria-label="Quitar comprobante"
            title="Quitar comprobante"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="btn-secondary btn-sm cursor-pointer inline-flex w-fit"
        >
          <Paperclip size={14} strokeWidth={1.75} />
          <span>Adjuntar comprobante</span>
        </label>
      )}
      <input
        id={inputId}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (f) onChange(f);
        }}
      />
    </div>
  );
}

function PagosTab({
  periodoId,
  periodoEtiqueta,
  estado,
  montoPeriodo,
  moneda,
  pagos,
  pagosContrato,
  mostrarLedgerContrato,
}: {
  periodoId: string;
  periodoEtiqueta: string;
  estado: string;
  montoPeriodo: number;
  moneda: string;
  pagos: Pago[];
  pagosContrato: PagoContrato[];
  mostrarLedgerContrato: boolean;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movingEstado, setMovingEstado] = useState(false);

  const montoPagado = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
  const pendiente = Math.max(montoPeriodo - montoPagado, 0);
  const porcentaje = montoPeriodo > 0 ? Math.min(100, (montoPagado / montoPeriodo) * 100) : 0;
  const pagoCompleto = montoPeriodo > 0 && montoPagado >= montoPeriodo;

  const agregarPago = async () => {
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Monto inválido");
      return;
    }
    if (!fecha) {
      setError("Falta la fecha");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("monto", String(montoNum));
      form.append("fecha", fecha);
      if (notas.trim()) form.append("notas", notas.trim());
      if (comprobante) form.append("comprobante", comprobante);
      const res = await fetch(`/api/cobros/periodos/${periodoId}/pagos`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo registrar el pago");
        return;
      }
      setMonto("");
      setNotas("");
      setComprobante(null);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setWorking(false);
    }
  };

  const eliminarPago = async (pagoId: string) => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/cobros/pagos/${pagoId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo quitar el pago");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setWorking(false);
    }
  };

  const moverAFacturado = async () => {
    setMovingEstado(true);
    setError(null);
    try {
      const res = await fetch(`/api/cobros/periodos/${periodoId}/cambiar-estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "facturado" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo cambiar el estado");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setMovingEstado(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-overline text-text-tertiary">Pago de</div>
            <div className="text-heading-2">{periodoEtiqueta}</div>
          </div>
          <div className="text-right">
            <div className="text-overline text-text-tertiary">Monto de esta parcialidad</div>
            <div className="num-tabular" style={{ fontSize: 22, fontWeight: 700 }}>
              {fmtMonto(montoPeriodo, moneda)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div>
            <div className="text-overline text-text-tertiary">Pagado</div>
            <div className="mt-1 num-tabular text-body-medium" style={{ color: "var(--state-success)" }}>
              {fmtMonto(montoPagado, moneda)}
            </div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary">Pendiente</div>
            <div className="mt-1 num-tabular text-body-medium">{fmtMonto(pendiente, moneda)}</div>
          </div>
        </div>
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 8, background: "var(--bg-overlay)" }}
        >
          <div
            style={{
              width: `${porcentaje}%`,
              height: "100%",
              background: pagoCompleto ? "var(--state-success)" : "var(--accent)",
              transition: "width 200ms ease",
            }}
          />
        </div>
        {pagoCompleto && estado !== "facturado" && (
          <button
            type="button"
            onClick={moverAFacturado}
            disabled={movingEstado}
            className="btn-secondary btn-sm w-fit"
          >
            <CheckCircle2 size={14} strokeWidth={1.75} />
            <span>{movingEstado ? "Moviendo…" : "Pago completo — ¿mover a Facturado?"}</span>
          </button>
        )}
      </section>

      <section className="card space-y-3">
        <h3 className="text-heading-2">Registrar un pago de &quot;{periodoEtiqueta}&quot;</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div>
            <label className="field-label">Fecha *</label>
            <input
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="field-label">Notas (opcional)</label>
          <input
            className="input"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: transferencia recibida por BBVA"
          />
        </div>
        <ComprobanteCampo file={comprobante} onChange={setComprobante} />
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={agregarPago}
          disabled={working}
          className="btn-primary w-fit"
        >
          <DollarSign size={14} strokeWidth={1.75} />
          <span>{working ? "Guardando…" : "Registrar pago"}</span>
        </button>
      </section>

      <section className="card space-y-3">
        <h3 className="text-heading-2">Pagos registrados de &quot;{periodoEtiqueta}&quot;</h3>
        {pagos.length === 0 ? (
          <p className="text-caption text-text-tertiary">Todavía no hay pagos registrados.</p>
        ) : (
          <ul className="space-y-2">
            {pagos.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-[10px] p-3"
                style={{ border: "1px solid var(--border-subtle)" }}
              >
                <span
                  className="flex items-center justify-center rounded-[8px] shrink-0"
                  style={{ width: 34, height: 34, background: "#DCFCE7", color: "#16A34A" }}
                >
                  <Receipt size={16} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="num-tabular text-body-medium">{fmtMonto(Number(p.monto), moneda)}</span>
                    <span className="text-caption text-text-tertiary">{formatFechaLarga(p.fecha)}</span>
                  </span>
                  {p.notas && <span className="block text-caption text-text-secondary mt-0.5">{p.notas}</span>}
                  {p.comprobante_url && (
                    <a
                      href={p.comprobante_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-caption mt-0.5 hover:underline"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <ExternalLink size={11} strokeWidth={1.75} />
                      Ver comprobante
                    </a>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => eliminarPago(p.id)}
                  disabled={working}
                  className="btn-icon btn-ghost shrink-0"
                  style={{ color: "var(--state-error)" }}
                  aria-label="Quitar pago"
                  title="Quitar pago"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mostrarLedgerContrato && (
        <section className="card space-y-3">
          <h3 className="text-heading-2">Pagos de este Cobro (todas las parcialidades)</h3>
          {pagosContrato.length === 0 ? (
            <p className="text-caption text-text-tertiary">
              Todavía no hay pagos registrados en ninguna parcialidad de este contrato.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {pagosContrato.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-[8px]"
                  style={{
                    background: p.esPeriodoActual ? "var(--bg-overlay)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="num-tabular text-body-medium">{fmtMonto(p.monto, moneda)}</span>
                    <span className="text-caption text-text-tertiary">{formatFechaCorta(p.fecha)}</span>
                  </span>
                  {p.esPeriodoActual ? (
                    <span className="badge badge-neutral shrink-0">Este período</span>
                  ) : (
                    <Link
                      href={`/panel/cobros/${p.periodoId}`}
                      className="text-caption shrink-0 hover:underline truncate"
                      style={{ color: "var(--text-secondary)", maxWidth: 180 }}
                    >
                      {p.periodoEtiqueta}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default function CobroPeriodoTabs({
  periodoId,
  periodoEtiqueta,
  estado,
  montoPeriodo,
  moneda,
  facturaPdfUrl,
  facturaPdfNombre,
  facturaXmlUrl,
  facturaXmlNombre,
  pagos,
  pagosContrato,
  mostrarLedgerContrato,
}: Props) {
  return (
    <div className="space-y-4">
      <PagosTab
        periodoId={periodoId}
        periodoEtiqueta={periodoEtiqueta}
        estado={estado}
        montoPeriodo={montoPeriodo}
        moneda={moneda}
        pagos={pagos}
        pagosContrato={pagosContrato}
        mostrarLedgerContrato={mostrarLedgerContrato}
      />

      <div className="space-y-2">
        <h3 className="text-heading-2 text-text-secondary" style={{ fontSize: 14 }}>
          Complemento de pago — factura (opcional)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AdjuntoFactura periodoId={periodoId} tipo="pdf" url={facturaPdfUrl} nombre={facturaPdfNombre} />
          <AdjuntoFactura periodoId={periodoId} tipo="xml" url={facturaXmlUrl} nombre={facturaXmlNombre} />
        </div>
      </div>
    </div>
  );
}
