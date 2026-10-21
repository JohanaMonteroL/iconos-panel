"use client";

// Control rápido de "pagado" — un badge + un botón de un clic, nada de
// formulario. Se resetea solo al cambiar de período (ver lib/pagos/periodo).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "@/lib/toast";
import { estaPagadoEnPeriodoActual, etiquetaPeriodoActual } from "@/lib/pagos/periodo";
import type { Periodicidad } from "@/types/db";

export default function TogglePagado({
  id,
  periodicidad,
  ultimoPagoMarcado,
}: {
  id: string;
  periodicidad: Periodicidad;
  ultimoPagoMarcado: string | null;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const pagado = estaPagadoEnPeriodoActual(periodicidad, ultimoPagoMarcado);
  const etiquetaPeriodo = etiquetaPeriodoActual(periodicidad);

  const toggle = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/pagos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ultimo_pago_marcado: pagado ? null : new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) {
        toast("No se pudo actualizar", { tipo: "error" });
        return;
      }
      toast(pagado ? "Marca de pagado quitada" : "Marcado como pagado");
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`badge ${pagado ? "badge-success" : "badge-warning"}`}>
        {pagado ? `Pagado${etiquetaPeriodo ? ` · ${etiquetaPeriodo}` : ""}` : "Pendiente"}
      </span>
      <button type="button" onClick={toggle} disabled={sending} className="btn-secondary btn-sm">
        {pagado ? <Circle size={14} strokeWidth={1.75} /> : <CheckCircle2 size={14} strokeWidth={1.75} />}
        <span>{pagado ? "Quitar marca" : "Marcar pagado"}</span>
      </button>
    </div>
  );
}
