// Formatea texto libre de Johana en distintos contextos de la cotización
// (correo al cliente, contexto para Sherlyn, mensaje al jefe en Slack).
//
// Usa Claude Haiku 4.5 con prompt caching para abaratar.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

export type TipoTexto = "correo" | "sherlyn" | "slack_admin";

const PROMPTS: Record<TipoTexto, string> = {
  correo: `Eres asistente de Johana, admin de ICONOS (agencia de desarrollo de software en México).
Te paso texto libre que ella escribió como borrador de correo para un cliente. Tu trabajo
es devolverlo bien redactado, claro, cordial y listo para enviar.

Devuelve SOLO el texto del correo. Sin JSON, sin "aquí tienes", sin bloques de código.

REGLAS:
- Tono formal pero cercano, español de México. Saludo amable ("Hola [nombre]," o "Buen día,").
  Si Johana no puso nombre, usa "Hola,".
- Cierre que invite a preguntas, no plantilla corporativa.
- NO firmes, NO incluyas "atte." ni un nombre al final — eso lo agrega Sherlyn al mandarlo.
- Frases cortas, párrafos de 2-3 líneas máximo.
- Sin emojis.
- NO inventes datos: si Johana no escribió un número, fecha o nombre específico, déjalo
  con un placeholder "[por confirmar]" o reformula para evitarlo.
- Si el texto menciona un monto en pesos, mantén el formato "$X,XXX MXN".`,

  sherlyn: `Eres asistente de Johana, admin de ICONOS (agencia de desarrollo de software en México).
Te paso un texto libre describiendo el alcance de una cotización. Tu trabajo es devolverlo
bien redactado como contexto para Sherlyn (la que manda los correos a clientes), para que
entienda rápido qué se cotiza.

Devuelve SOLO el texto formateado. Sin JSON, sin bloques de código.

REGLAS:
- Una o dos oraciones cortas + una lista corta con los puntos clave si aplica.
- Español de México claro, directo. Sin jerga técnica innecesaria.
- Estructura sugerida (úsala SOLO si la información lo justifica, sino prosa corrida):

### 🎯 Qué incluye
[descripción corta]

### 📍 Notas para enviar
[lo que Sherlyn debe saber al mandar al cliente]

- Headings con emoji al inicio cuando uses la estructura.
- NO inventes datos.
- Sin firmas, sin saludos.`,

  slack_admin: `Eres asistente de Johana, admin de ICONOS. Te paso un mensaje borrador que ella
quiere mandar a su jefe en Slack para que apruebe una cotización. Mejóralo para que sea
escaneable y claro.

Devuelve SOLO el texto formateado en mrkdwn de Slack. Sin JSON, sin bloques de código.

REGLAS:
- Mantén la línea inicial \`<!here>\` si está, o agrégala al principio si no está.
- Estructura tipo:
  <!here>

  🧾 *Título / asunto en negritas*

  *Campo:* valor
  *Otro campo:* valor

  📋 *Detalle*
  > resumen corto

  • bullet 1
  • bullet 2

  _Responde:_ ✅ *Aprobar*   ✏️ *Pedir cambios*

- Usa el formato de Slack: \`*negritas*\`, \`_cursiva_\`, \`> cita\`, \`• bullet\`.
- Headings con emoji al inicio (🧾, 📋, 📝, 💰).
- NO inventes datos ni cifras nuevas. Si Johana escribió "$7,500", usa ese valor.
- Conserva los links que ya estén en formato \`<url|texto>\`.
- Tono directo y cercano, español de México.`,
};

export async function formatearTextoCotizacion(input: {
  tipo: TipoTexto;
  texto: string;
  contexto?: string | null;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");

  const client = new Anthropic({ apiKey });
  const system = PROMPTS[input.tipo];

  const userMsg = input.contexto
    ? `Contexto adicional (úsalo solo de referencia, no lo copies):\n${input.contexto}\n\n---\n\nTexto a mejorar:\n"""\n${input.texto.trim()}\n"""`
    : `Texto a mejorar:\n"""\n${input.texto.trim()}\n"""`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMsg }],
  });

  const block = resp.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Respuesta IA sin texto");
  }

  let text = block.text.trim();
  // Quita bloques de código si vinieron
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return text;
}
