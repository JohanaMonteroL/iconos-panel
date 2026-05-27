// Formatea con IA un texto libre que Johana escribe en el wizard de tickets.
// En UNA sola llamada devuelve { titulo_corto, descripcion_md } con las
// secciones estructuradas según el tipo de ticket.
//
// Usa Claude Haiku 4.5 + prompt caching para que la llamada siguiente
// cueste 10% del precio normal (~$0.0005 USD/clic en caliente).

import Anthropic from "@anthropic-ai/sdk";
import type { SubTipoTicket, TipoTicket } from "@/lib/jira/format";

const MODEL = "claude-haiku-4-5-20251001";

export type FormatTicketResult = {
  titulo_corto: string;
  descripcion_md: string;
};

const SYSTEM_PROMPT = `Eres un asistente para Johana, admin de ICONOS (agencia de desarrollo de software en México).
Recibes texto libre que Johana escribe rápido sobre un ticket de trabajo para un programador
(a veces solo una idea suelta, "fernando me pidio cambiar contraseña del servidor"), y tu
trabajo es mejorar la redacción para que el programador entienda perfectamente qué tiene que
hacer.

Devuelves un JSON con esta forma exacta:
{ "titulo_corto": "...", "descripcion_md": "..." }

REGLAS DURAS:
- Devuelve SIEMPRE solo el JSON. Sin texto antes/después, sin bloques de código, sin comentarios.
- "titulo_corto": máximo 80 caracteres. Específico y accionable. SIN prefijos como
  "Soporte:" / "Estimación:" — esos los agrega el sistema después.
- "descripcion_md": markdown limpio. La estructura la decides tú según lo que el ticket
  necesite. Puede ser prosa corrida, una lista, varios párrafos — lo que sea más claro.
- NO inventes datos. Si falta información importante, márcala como "_(falta confirmar con
  Johana: …)_" para que el programador sepa que es un hueco.

QUÉ DEBE TENER LA DESCRIPCIÓN (cuando aplique):
- Quién pidió el cambio o reportó el problema (si Johana lo mencionó).
- Qué hay que hacer, con suficiente detalle para que el programador no tenga que adivinar.
- Por qué (si Johana dio contexto que ayude a tomar decisiones).
- Dónde aplica: ¿qué sistema, servicio, repo, ambiente?
- Qué se considera "terminado" si no es obvio.
- Para bugs: cómo se reproduce y qué se ve mal vs qué debería verse.

FORMATO (IMPORTANTE — siempre fácil de escanear):
- SIEMPRE divide la descripción en secciones con headings H3 (### ) acompañados de un
  emoji al inicio del título. Hace el ticket escaneable cuando el programador lo abre.
- Elige los emojis según el contenido del heading. Ejemplos de mapeo (úsalos cuando
  apliquen, no son obligatorios):
    🎯 Objetivo / Qué hay que hacer
    👤 Solicitado por / Contexto del cliente
    🔧 Cambios técnicos / Implementación
    🐞 Problema / Bug
    🔁 Pasos para reproducir
    ✅ Resultado esperado / Criterio de aceptación
    ❌ Resultado actual
    📎 Evidencia / Capturas / Links
    🧠 Notas / Supuestos
    📍 Dónde aplica / Ambiente
    ❓ Preguntas a confirmar
- Headings concisos, máximo 3-4 palabras después del emoji.
- Dentro de cada sección: prosa corta o listas con guiones. Frases breves.
- Si una sección queda con un solo dato, igual ponla con su heading — el formato consistente
  vale más que ahorrar líneas.
- Para tickets muy chicos (1-2 oraciones), igual usa al menos un heading principal
  (ej. "### 🎯 Qué hay que hacer") seguido del contenido.

ESTILO:
- Español de México claro, sin spanglish, sin jerga corporativa.
- Tono directo y cercano. "Hay que…", "Pide…", "Asegúrate de…". NO uses "usted".
- Frases cortas, sin floritura.
- NO firmes, NO saludos, NO "atte.", NO "espero su pronta respuesta".
- Los emojis SOLO en los headings — no los uses dentro del texto del cuerpo.`;

function buildUserPrompt(input: {
  texto: string;
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

  return `Tipo de ticket: ${tipoLabel}

Texto libre de Johana:
"""
${input.texto.trim()}
"""

Devuelve el JSON con titulo_corto y descripcion_md según las reglas del system.`;
}

export async function formatearTicket(input: {
  texto: string;
  tipo: TipoTicket;
  subTipo: SubTipoTicket | null;
}): Promise<FormatTicketResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");

  const client = new Anthropic({ apiKey });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserPrompt(input) }],
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
  if (
    typeof obj.titulo_corto !== "string" ||
    typeof obj.descripcion_md !== "string"
  ) {
    throw new Error("La IA devolvió un JSON con estructura incorrecta");
  }

  return {
    titulo_corto: obj.titulo_corto.trim().slice(0, 200),
    descripcion_md: obj.descripcion_md.trim(),
  };
}
