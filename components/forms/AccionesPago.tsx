"use client";

// Archivar/activar y borrar un Pago desde su detalle. Borrar es definitivo
// (un Pago no está ligado a cobros/cotizaciones), así que pide confirmación.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

export default function AccionesPago({ id, activo }: { id: string; activo: boolean }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  const toggleActivo = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/pagos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !activo }),
      });
      if (!res.ok) {
        toast("No se pudo actualizar", { tipo: "error" });
        return;
      }
      toast(activo ? "Pago archivado" : "Pago activado");
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  const eliminar = async () => {
    if (!confirm("¿Borrar este pago? Esto también borra su registro de pagos. No se puede deshacer.")) return;
    setSending(true);
    try {
      const res = await fetch(`/api/pagos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast("No se pudo borrar", { tipo: "error" });
        return;
      }
      toast("Pago borrado");
      router.push("/panel/pagos");
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={toggleActivo} disabled={sending} className="btn-secondary">
        {activo ? <Archive size={16} strokeWidth={1.75} /> : <ArchiveRestore size={16} strokeWidth={1.75} />}
        <span>{activo ? "Archivar" : "Activar"}</span>
      </button>
      <button type="button" onClick={eliminar} disabled={sending} className="btn-danger">
        <Trash2 size={16} strokeWidth={1.75} />
        <span>Borrar</span>
      </button>
    </div>
  );
}
