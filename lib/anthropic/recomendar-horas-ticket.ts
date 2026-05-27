// Sugiere horas estimadas para un ticket a partir de su descripción
// formateada y el tipo. Devuelve { horas, justificacion }.

import Anthropic from "@anthropic-ai/sdk";
import type { SubTipoTicket, TipoTicket } from "@/lib/jira/format";

const MODEL = "claude-haiku-4-5-20251001";

export type RecomendarHorasResult = {
  horas: number;
  justificacion: string;
};

const SYSTEM_PROMPT = `Eres un líder técnico con experiencia estimando trabajo de desarrollo de software en
una agencia mexicana. Recibes la descripción de un ticket y su tipo, y sugieres
cuántas horas tomaría.

Reglas:
- Devuelve SIEMPRE un JSON válido { "horas": <number>, "justificacion": "..." }.
- Sin texto adicional, sin bloques de código, sin comentarios.
- "horas" es un número (puede tener un decimal, ej. 2.5).
- "justificacion": máximo 2 oraciones cortas, español claro, sin jerga corporativa.
- Estimación realista para un programador con experiencia media. No infles "por si acaso".
- Si la descripción es muy vaga, da un número conservador pero útil, y en la
  justificacion menciona el supuesto principal.

Referencias para calibrar (no son límites estrictos):
- Bug menor (cambio de contraseña, ajuste de texto): 0.5–2 hrs.
- Bug medio (lógica de negocio que se descompuso): 2–8 hrs.
- Tarea pequeña de desarrollo: 4–16 hrs.
- Tarea de desarrollo mediana (módulo nuevo simple): 16–40 hrs.
- Investigación / spike acotado: 4–16 hrs.
- Estimación de cotización (analizar y estimar): 1–4 hrs.`;

function buildPrompt(input: {
  descripcionMd: string;
  tipo: TipoTicket;
  subTipo: SubTipoTicket | null;
}): string {
  const tipoLabel =
    input.tipo === "soporte" && input.subTipo === "bug"
      ? "Soporte (Bug)"
      : input.tipo === "soporte"
      ? "Soporte (Task)"
      : input.tipo === "desarrollo" && input.subTipo === "historia"
      ? "Desarrollo (Historia)"
      : input.tipo === "desarrollo"
      ? "Desarrollo (Task)"
      : input.tipo === "estimacion"
      ? "Estimación"
      : "Investigación";

  return `Tipo: ${tipoLabel}

Descripción del ticket (markdown):
"""
${input.descripcionMd.trim()}
"""

Devuelve el JSON con horas y justificacion.`;
}

export async function recomendarHorasTicket(input: {
  descripcionMd: string;
  tipo: TipoTicket;
  subTipo: SubTipoTicket | null;
}): Promise<RecomendarHorasResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");

  const client = new Anthropic({ apiKey });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  const block = resp.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Respuesta de IA sin contenido de texto");
  }

  let text = block.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("La IA no devolvió JSON válido: " + text.slice(0, 200));
  }

  const obj = parsed as Record<string, unknown>;
  const horasNum = Number(obj.horas);
  if (!Number.isFinite(horasNum) || horasNum <= 0) {
    throw new Error("La IA no devolvió un número de horas válido");
  }

  return {
    horas: Math.round(horasNum * 10) / 10,
    justificacion:
      typeof obj.justificacion === "string"
        ? obj.justificacion.trim().slice(0, 400)
        : "",
  };
}
