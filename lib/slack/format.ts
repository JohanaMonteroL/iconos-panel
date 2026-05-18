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

  partes.push("@aqui");
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
