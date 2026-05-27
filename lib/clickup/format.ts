import type { EstimacionLimpia } from "@/lib/anthropic/process";

type FormatInput = {
  limpia: EstimacionLimpia;
  programadorNombre: string;
  bufferPct: number;
  horasEnvio: number;
  notas?: string | null;
};

// Quita emojis y símbolos pictográficos del título.
// Implementación que no usa el flag /u (compatible con targets antiguos).
export function stripEmojis(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const esEmoji =
      // Símbolos generales y dingbats
      (cp >= 0x2600 && cp <= 0x27bf) ||
      // Símbolos pictóricos diversos / suplementarios
      (cp >= 0x1f000 && cp <= 0x1faff) ||
      // Suplemento privado / variation selectors / ZWJ
      cp === 0xfe0f ||
      cp === 0x200d;
    if (!esEmoji) out += ch;
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Reparte horas_envio (total con buffer) proporcionalmente entre las tareas,
 * usando los puntos medios como peso. Garantiza que los valores sumen
 * exactamente horas_envio (ajuste en la última tarea).
 */
function escalaTareasParaSumar(
  tareas: EstimacionLimpia["tareas"],
  totalObjetivo: number
): number[] {
  if (tareas.length === 0) return [];
  const puntosMedios = tareas.map((t) => (t.hrs_min + t.hrs_max) / 2);
  const sumaMedios = puntosMedios.reduce((a, b) => a + b, 0);
  if (sumaMedios <= 0) {
    // Reparto uniforme si no hay datos
    const cada = Math.round(totalObjetivo / tareas.length);
    return tareas.map((_, i) =>
      i === tareas.length - 1
        ? totalObjetivo - cada * (tareas.length - 1)
        : cada
    );
  }
  const factor = totalObjetivo / sumaMedios;
  const escaladas = puntosMedios.map((m) => Math.max(0, Math.round(m * factor)));
  // Ajustar para que sumen exactamente totalObjetivo
  const diff = totalObjetivo - escaladas.reduce((a, b) => a + b, 0);
  if (diff !== 0 && escaladas.length > 0) {
    escaladas[escaladas.length - 1] = Math.max(
      0,
      escaladas[escaladas.length - 1] + diff
    );
  }
  return escaladas;
}

// Estructura de descripción del ticket de Cotizaciones en ClickUp.
// Markdown con H3 (###) + tablas para mejor lectura.
export function buildClickUpDescription({
  limpia,
  programadorNombre,
  bufferPct,
  horasEnvio,
  notas,
}: FormatInput): string {
  // Tiempo en semanas (40 hrs / semana de trabajo)
  const HRS_POR_SEMANA = 40;
  const semanas = horasEnvio / HRS_POR_SEMANA;
  const semanasTxt =
    semanas < 1
      ? `${Math.round(semanas * 10) / 10} semana`
      : `${Math.round(semanas * 10) / 10} semana${semanas >= 2 ? "s" : ""}`;

  // Reparto de horas por tarea para que sumen horas_envio
  const horasPorTarea = escalaTareasParaSumar(limpia.tareas, horasEnvio);

  const filaTabla = (nombre: string, descripcion: string, hrs: number) => {
    const detalle = descripcion ? ` _(${descripcion.replace(/\|/g, " ")})_` : "";
    return `| **${nombre}**${detalle} | ${hrs} |`;
  };

  const tablaTareas = [
    "| Descripción | Horas |",
    "| --- | :---: |",
    ...limpia.tareas.map((t, i) =>
      filaTabla(t.nombre, t.descripcion, horasPorTarea[i] ?? 0)
    ),
    `| **TOTAL** | **${horasEnvio}** |`,
  ].join("\n");

  const bloques: string[] = [];

  bloques.push("### 📝 Descripción");
  bloques.push("");
  bloques.push(limpia.contexto_sherlyn || "—");

  bloques.push("");
  bloques.push("### ⏱️ Horas totales");
  bloques.push("");
  bloques.push(`- **Total:** ${horasEnvio} horas`);
  bloques.push(
    `- **Buffer aplicado:** ${bufferPct > 0 ? `${bufferPct}%` : "Sin buffer"}`
  );
  bloques.push(`- **Tiempo estimado:** ~${semanasTxt} (40 hrs/semana)`);
  bloques.push(`- **Programador:** ${programadorNombre}`);

  bloques.push("");
  bloques.push("### 📋 Detalle de cotización");
  bloques.push("");
  bloques.push(tablaTareas);

  bloques.push("");
  bloques.push("### ✉️ Correo propuesto al cliente");
  bloques.push("");
  bloques.push(limpia.borrador_correo || "—");

  if (notas && notas.trim()) {
    bloques.push("");
    bloques.push("### 🗒️ Notas");
    bloques.push("");
    bloques.push(notas.trim());
  }

  return bloques.join("\n");
}

// ── Descripción para cotización de monto fijo (no horas) ────────────────

export type ConceptoFijo = {
  concepto: string;
  cantidad: number;
  precio_unitario: number;
};

export function buildClickUpDescriptionFijo({
  montoFijoMxn,
  programadorNombre,
  descripcion,
  conceptos,
  borradorCorreo,
  notas,
}: {
  nombre?: string; // disponible si se quiere agregar arriba; hoy no se usa
  montoFijoMxn: number;
  programadorNombre?: string | null;
  descripcion: string;
  conceptos?: ConceptoFijo[];
  borradorCorreo?: string | null;
  notas?: string | null;
}): string {
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const bloques: string[] = [];
  bloques.push("### 📝 Descripción");
  bloques.push("");
  bloques.push(descripcion || "—");

  if (conceptos && conceptos.length > 0) {
    bloques.push("");
    bloques.push("### 📋 Conceptos");
    bloques.push("");
    bloques.push("| Concepto | Cantidad | Precio unitario | Subtotal |");
    bloques.push("| --- | :---: | :---: | :---: |");
    for (const c of conceptos) {
      const subtotal = (c.cantidad || 0) * (c.precio_unitario || 0);
      const nombre = c.concepto.replace(/\|/g, " ");
      bloques.push(
        `| ${nombre} | ${c.cantidad} | ${fmt(c.precio_unitario)} | ${fmt(subtotal)} |`
      );
    }
    bloques.push(`| **TOTAL** | | | **${fmt(montoFijoMxn)}** |`);
  } else {
    bloques.push("");
    bloques.push("### 💰 Monto fijo");
    bloques.push("");
    bloques.push(`- **Total:** ${fmt(montoFijoMxn)} MXN`);
  }

  bloques.push("");
  bloques.push("### ℹ️ Datos");
  bloques.push("");
  bloques.push(`- **Tipo:** Cotización extraordinaria (no horas)`);
  if (programadorNombre && programadorNombre !== "—") {
    bloques.push(`- **Atendido por:** ${programadorNombre}`);
  }

  if (borradorCorreo && borradorCorreo.trim()) {
    bloques.push("");
    bloques.push("### ✉️ Correo propuesto al cliente");
    bloques.push("");
    bloques.push(borradorCorreo.trim());
  }

  if (notas && notas.trim()) {
    bloques.push("");
    bloques.push("### 🗒️ Notas");
    bloques.push("");
    bloques.push(notas.trim());
  }

  return bloques.join("\n");
}
