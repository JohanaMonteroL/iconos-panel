import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  labelPeriodicidad,
  labelFormaPago,
  labelTipoPago,
  labelComprobanteTipo,
} from "@/lib/pagos/labels";
import { fmtMXN, fmtPercent, montoIVA } from "@/lib/pagos/calculos";
import { formatearClabe } from "@/lib/pagos/clabe";
import CopyButton from "@/components/ui/CopyButton";
import PagoFormModal from "@/components/forms/PagoFormModal";
import AccionesPago from "@/components/forms/AccionesPago";
import TogglePagado from "@/components/forms/TogglePagado";
import RegistroPagos from "@/components/forms/RegistroPagos";
import ChecklistPasos from "@/components/forms/ChecklistPasos";
import type { Pago, PagoRegistro } from "@/types/db";

export const dynamic = "force-dynamic";

async function getPago(id: string): Promise<{ pago: Pago | null; registros: PagoRegistro[] }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { pago: null, registros: [] };
  const supa = createSupabaseServiceClient();
  const [{ data: pago }, { data: registros }] = await Promise.all([
    supa.from("pagos_proveedores").select("*").eq("id", id).maybeSingle(),
    supa.from("pagos_proveedores_registro").select("*").eq("pago_id", id).order("fecha", { ascending: false }),
  ]);
  return { pago: (pago as Pago) ?? null, registros: (registros as PagoRegistro[]) ?? [] };
}

// Caja de campo — mismo lenguaje visual que los campos editables de la ficha
// de Proyecto (borde sutil, esquinas redondeadas, label arriba): evita las
// filas con border-bottom apiladas que se veían mal en grid de varias
// columnas. `copyValue` permite copiar un valor distinto al que se muestra
// (ej. el total sin el símbolo de moneda, listo para pegar en un banco).
function CampoCaja({
  label,
  value,
  copyValue,
  copiable = false,
}: {
  label: string;
  value: string;
  copyValue?: string;
  copiable?: boolean;
}) {
  const puedeCopiar = copiable && value !== "—";
  return (
    <div>
      <label className="field-label">{label}</label>
      <div
        className="flex items-center justify-between gap-2 rounded-[9px]"
        style={{ border: "1px solid var(--border-default)", padding: "9px 11px", minHeight: 40 }}
      >
        <span className={`text-body break-words ${value === "—" ? "text-text-tertiary" : ""}`}>{value}</span>
        {puedeCopiar && <CopyButton value={copyValue ?? value} label={label} />}
      </div>
    </div>
  );
}

export default async function PagoDetallePage({ params }: { params: { id: string } }) {
  const { pago, registros } = await getPago(params.id);
  if (!pago) notFound();

  return (
    <>
      <div>
        <Link href="/panel/pagos" className="inline-flex items-center gap-1 text-caption text-text-secondary">
          <ChevronLeft size={14} strokeWidth={1.75} />
          Pagos
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-display">{pago.nombre_pago}</h1>
            {!pago.activo && <span className="badge badge-neutral">Inactivo</span>}
          </div>
          <p className="text-body text-text-secondary">{pago.empresa_contacto || "Sin empresa/contacto"}</p>
          <TogglePagado id={pago.id} periodicidad={pago.periodicidad} ultimoPagoMarcado={pago.ultimo_pago_marcado} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PagoFormModal pago={pago} />
          <AccionesPago id={pago.id} activo={pago.activo} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="card space-y-4">
          <div>
            <h2 className="text-heading-2">Instrucciones de pago</h2>
            <p className="text-caption text-text-secondary mt-0.5">Para copiar y pegar al ejecutar el pago.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoCaja label="Nombre del pago" value={pago.nombre_pago} copiable />
            <CampoCaja label="Nombre de la cuenta (titular)" value={pago.titular || "—"} copiable />
            <CampoCaja
              label="Banco / clave o cuenta"
              value={pago.banco_o_cuenta ? formatearClabe(pago.banco_o_cuenta) : "—"}
              copyValue={pago.banco_o_cuenta ?? undefined}
              copiable
            />
            <CampoCaja
              label="Total a pagar"
              value={fmtMXN(pago.total_a_pagar)}
              copyValue={pago.total_a_pagar.toFixed(2)}
              copiable
            />
            <CampoCaja label="Referencia" value={pago.referencia || "—"} copiable />
            <CampoCaja label="Correo para enviar comprobante" value={pago.correo_comprobante || "—"} copiable />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-heading-2">Datos del pago</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoCaja label="Empresa / contacto" value={pago.empresa_contacto || "—"} />
            <CampoCaja label="Periodicidad" value={labelPeriodicidad(pago.periodicidad)} />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <CampoCaja label="Monto" value={fmtMXN(pago.monto)} />
            <CampoCaja label="IVA" value={`${fmtPercent(pago.iva)} · ${fmtMXN(montoIVA(pago.monto, pago.iva))}`} />
            <CampoCaja label="Total" value={fmtMXN(pago.total_a_pagar)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CampoCaja label="Forma de pago" value={labelFormaPago(pago.forma_pago)} />
            <CampoCaja label="Tipo de pago" value={labelTipoPago(pago.tipo_pago)} />
          </div>
          <CampoCaja label="Comprobante a solicitar" value={labelComprobanteTipo(pago.comprobante_tipo)} />
          {pago.notas && <CampoCaja label="Notas" value={pago.notas} />}
        </div>
      </div>

      <ChecklistPasos pagoId={pago.id} pasos={pago.pasos ?? []} />
      <RegistroPagos pagoId={pago.id} registros={registros} totalAPagar={pago.total_a_pagar} />
    </>
  );
}
