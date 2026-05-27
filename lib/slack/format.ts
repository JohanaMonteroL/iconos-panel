// Generador del mensaje de Slack que enviaremos al jefe para aprobar
// una cotización. Mantenemos el texto en un módulo aparte para poder
// previsualizarlo en el panel SIN haber implementado aún el envío.

import type { EstimacionLimpia } from "@/lib/anthropic/process";

type SlackPreviewInput = {
  nombreCotizacion: string;
  proyecto?: string | null;
  programador: string;
  horasEnvio: number;
  bufferPct?: number;
  descripcionCorta: string;
  puntosClave: string[];
  notas?: string | null;
  clickupUrl?: string | null;
};

export function buildSlackText({
  nombreCotizacion,
  proyecto,
  programador,
  horasEnvio,
  bufferPct = 0,
  descripcionCorta,
  puntosClave,
  notas,
  clickupUrl,
}: SlackPreviewInput): string {
  const partes: string[] = [];

  // Slack mrkdwn: <url|text> renderiza como hipervínculo
  const nombreLink = clickupUrl
    ? `<${clickupUrl}|${nombreCotizacion}>`
    : nombreCotizacion;

  // <!here> es la sintaxis de Slack para etiquetar a todos los miembros activos del canal.
  partes.push("<!here>");
  partes.push("");
  partes.push("🧾 *Cotización lista para revisión*");
  partes.push("");
  partes.push(`*Nombre:* ${nombreLink}${proyecto ? ` — ${proyecto}` : ""}`);
  partes.push(
    `*Tiempo estimado:* ${horasEnvio} horas${
      bufferPct > 0 ? ` _(incluye ${bufferPct}% de buffer)_` : ""
    }`
  );
  partes.push(`*Programador:* ${programador}`);
  partes.push("");
  partes.push("📋 *Detalle de cotización*");
  partes.push(`> ${descripcionCorta}`);

  if (puntosClave.length > 0) {
    partes.push("");
    for (const p of puntosClave) partes.push(`• ${p}`);
  }

  if (notas && notas.trim()) {
    partes.push("");
    partes.push(`📝 *Notas:* ${notas.trim()}`);
  }

  partes.push("");
  partes.push("_Responde:_  ✅ *Aprobar*   ✏️ *Pedir cambios*");

  return partes.join("\n");
}

// ── Variante para cotizaciones de monto fijo (no horas) ───────────────

export type ConceptoFijo = {
  concepto: string;
  cantidad: number;
  precio_unitario: number;
};

type SlackFijoInput = {
  nombreCotizacion: string;
  proyecto?: string | null;
  programador?: string | null; // opcional — quien la atiende
  montoFijoMxn: number;
  descripcionCorta: string;
  conceptos?: ConceptoFijo[];
  notas?: string | null;
  clickupUrl?: string | null;
};

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function buildSlackTextFijo({
  nombreCotizacion,
  proyecto,
  programador,
  montoFijoMxn,
  descripcionCorta,
  conceptos,
  notas,
  clickupUrl,
}: SlackFijoInput): string {
  const nombreLink = clickupUrl
    ? `<${clickupUrl}|${nombreCotizacion}>`
    : nombreCotizacion;

  const montoFmt = fmtMxn(montoFijoMxn);

  const partes: string[] = [];
  partes.push("<!here>");
  partes.push("");
  partes.push("🧾 *Cotización lista para revisión* _(monto fijo)_");
  partes.push("");
  partes.push(`*Nombre:* ${nombreLink}${proyecto ? ` — ${proyecto}` : ""}`);
  partes.push(`*Monto total:* ${montoFmt} MXN`);
  if (programador && programador !== "—") {
    partes.push(`*Atendido por:* ${programador}`);
  }

  if (conceptos && conceptos.length > 0) {
    partes.push("");
    partes.push("📋 *Conceptos*");
    for (const c of conceptos) {
      const subtotal = (c.cantidad || 0) * (c.precio_unitario || 0);
      const cantidad = Number.isInteger(c.cantidad)
        ? String(c.cantidad)
        : String(c.cantidad);
      partes.push(
        `• ${cantidad}× ${c.concepto} — ${fmtMxn(subtotal)} _(${fmtMxn(
          c.precio_unitario
        )} c/u)_`
      );
    }
  }

  if (descripcionCorta && descripcionCorta.trim()) {
    partes.push("");
    partes.push("📝 *Detalle*");
    partes.push(`> ${descripcionCorta.trim()}`);
  }

  if (notas && notas.trim()) {
    partes.push("");
    partes.push(`📝 *Notas:* ${notas.trim()}`);
  }

  partes.push("");
  partes.push("_Responde:_  ✅ *Aprobar*   ✏️ *Pedir cambios*");
  return partes.join("\n");
}

// Fallback inteligente cuando la IA no devolvió descripcion_corta
export function shortDescripcion(limpia: EstimacionLimpia | null): string {
  if (!limpia) return "Estimación pendiente de procesar.";
  if (limpia.descripcion_corta && limpia.descripcion_corta.trim()) {
    return limpia.descripcion_corta.trim();
  }
  // Derivar de contexto_sherlyn (primera oración)
  const primera = limpia.contexto_sherlyn.split(/[.\n]/)[0]?.trim();
  if (primera) return primera;
  return limpia.tareas
    .slice(0, 2)
    .map((t) => t.nombre)
    .join(" · ");
}

// Fallback para puntos_clave usando los nombres de las tareas (top 4)
export function puntosFallback(limpia: EstimacionLimpia | null): string[] {
  if (!limpia) return [];
  if (limpia.puntos_clave && limpia.puntos_clave.length > 0)
    return limpia.puntos_clave;
  return limpia.tareas.slice(0, 4).map((t) => t.nombre);
}
