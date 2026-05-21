"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Marca la estimación como revisada al cargar el detalle. Resta del badge
 * del sidebar y del icono nativo del PWA. Es idempotente — solo escribe
 * la primera vez que se abre.
 */
export default function MarcarRevisada({
  estimacionId,
}: {
  estimacionId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/estimaciones/${estimacionId}/marcar-revisada`, {
      method: "POST",
    })
      .then(() => {
        if (!cancelado) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [estimacionId, router]);

  return null;
}
