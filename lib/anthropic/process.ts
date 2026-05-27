import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

export type EstimacionCruda = {
  nombre_solicitud: string;
  notas: string | null;
  tareas: Array<{
    nombre: string;
    descripcion: string;
    hrs_min: number;
    hrs_max: number;
  }>;
};

export type EstimacionLimpia = {
  nombre_solicitud: string;
  tareas: Array<{
    nombre: string;
    descripcion: string;
    hrs_min: number;
    hrs_max: number;
  }>;
  recomendacion_horas: string;
  contexto_sherlyn: string;
  borrador_correo: string;
  descripcion_corta: string;
  puntos_clave: string[];
};

const SYSTEM_PROMPT = `Eres un asistente para ICONOS, una empresa de desarrollo de software en México.
Tu trabajo es procesar estimaciones de horas que envían los programadores y prepararlas
para que Johana (admin) las pueda enviar como cotización a un cliente.

Reglas estrictas de fondo:
- Mantén el sentido técnico de lo que escribió el programador, no inventes alcance.
- Reescribe en español de México claro para un cliente NO técnico.
- No uses jerga (deploy, push, merge, refactor, endpoint, backend, frontend, etc.) — explícalo en términos de negocio.
- No agregues horas ni tareas, solo reescribe.
- Si el nombre de la solicitud no tiene sentido con las tareas, propón uno mejor.
- Sé conciso.

Reglas de TONO para el correo al cliente:
- Formal pero cercano. NO institucional, NO frío, NO rígido.
- Habla "de tú a tú" como una persona real escribiendo, no como una plantilla corporativa.
- Saludo cordial (ej. "Hola [nombre]," o "Buen día,"), sin "Estimado(a) cliente,".
- Cierre que invite a preguntas o conversación, sin "Quedamos atentos a sus comentarios" estilo machote.
- Sin firma ni nombre al final — Sherlyn lo agrega.
- Mantén oraciones cortas y directas.

Devuelves SIEMPRE un JSON válido, sin texto adicional, sin markdown, sin bloques de código.`;

function buildUserPrompt(raw: EstimacionCruda, programador: string): string {
  return `Estimación enviada por: ${programador}

ESTIMACIÓN CRUDA (texto original del programador):
${JSON.stringify(raw)}

Devuelve un JSON con esta estructura exacta:
{
  "nombre_solicitud": "Nombre limpio en español formal",
  "tareas": [
    { "nombre": "...", "descripcion": "...", "hrs_min": <number>, "hrs_max": <number> }
  ],
  "descripcion_corta": "Una o dos oraciones que resumen TODO lo que incluye la cotización, para el preview en Slack. Lenguaje claro, sin jerga técnica.",
  "puntos_clave": [
    "Bullet 1 (lo más importante incluido)",
    "Bullet 2",
    "Bullet 3"
  ],
  "recomendacion_horas": "Una oración: 'Las horas parecen adecuadas' o 'Considera aumentar X horas en pruebas porque...'",
  "contexto_sherlyn": "1-2 párrafos breves para Sherlyn — qué se va a hacer, cualquier supuesto importante",
  "borrador_correo": "Cuerpo del correo en español al cliente. Tono formal pero cercano: saludo cordial, oraciones cortas, cierre que invite a preguntas. SIN firma, SIN nombre final."
}

Reglas para puntos_clave:
- Entre 3 y 6 bullets máximo.
- NO listes todas las tareas — solo lo más importante de lo que se va a entregar.
- Lenguaje de negocio, no técnico.
- Cada bullet en una oración corta, sin punto final.

Mantén las horas mín/máx exactamente como vienen — solo limpia el texto.`;
}

export async function procesarEstimacion(
  raw: EstimacionCruda,
  programador: string
): Promise<EstimacionLimpia> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurado");
  }

  const client = new Anthropic({ apiKey });

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserPrompt(raw, programador) }],
  });

  if (resp.stop_reason === "max_tokens") {
    throw new Error(
      "La IA no terminó de generar la respuesta (límite de tokens alcanzado). Intenta con una estimación más corta."
    );
  }

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

  const obj = parsed as Record<string, any>;
  if (
    typeof obj.nombre_solicitud !== "string" ||
    !Array.isArray(obj.tareas) ||
    typeof obj.recomendacion_horas !== "string" ||
    typeof obj.contexto_sherlyn !== "string" ||
    typeof obj.borrador_correo !== "string"
  ) {
    throw new Error("La IA devolvió un JSON con estructura incorrecta");
  }

  return {
    nombre_solicitud: obj.nombre_solicitud,
    tareas: obj.tareas.map((t: any) => ({
      nombre: String(t.nombre ?? ""),
      descripcion: String(t.descripcion ?? ""),
      hrs_min: Number(t.hrs_min) || 0,
      hrs_max: Number(t.hrs_max) || 0,
    })),
    recomendacion_horas: obj.recomendacion_horas,
    contexto_sherlyn: obj.contexto_sherlyn,
    borrador_correo: obj.borrador_correo,
    descripcion_corta:
      typeof obj.descripcion_corta === "string" && obj.descripcion_corta.trim()
        ? obj.descripcion_corta.trim()
        : obj.contexto_sherlyn.split(/[.\n]/)[0]?.slice(0, 200) ?? "",
    puntos_clave: Array.isArray(obj.puntos_clave)
      ? obj.puntos_clave
          .map((p: unknown) => String(p ?? "").trim())
          .filter(Boolean)
          .slice(0, 6)
      : [],
  };
}
