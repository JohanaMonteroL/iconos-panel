import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `Eres un experto en estimación de proyectos de software para una agencia mexicana.
Analiza estimaciones que envían los programadores y opinas si las horas parecen razonables.

Reglas:
- Sé directo y breve (máximo 3 oraciones).
- Habla en español neutral, tono profesional pero cercano.
- Si las horas parecen adecuadas, dilo claramente.
- Si crees que faltan o sobran horas para algo (pruebas, juntas, integración, etc.), señálalo concretamente.
- No inventes alcance: solo opinas sobre las horas dadas las descripciones.
- No menciones que eres una IA.`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en .env.local" },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = String(body?.nombre_solicitud ?? "").trim();
  const tareas = Array.isArray(body?.tareas) ? body.tareas : [];
  if (!nombre || tareas.length === 0) {
    return NextResponse.json(
      { error: "Necesito un nombre de solicitud y al menos una tarea." },
      { status: 422 }
    );
  }

  const tareasTxt = tareas
    .map((t: any, i: number) => {
      const desc = t?.descripcion ? ` — ${t.descripcion}` : "";
      const masProb =
        t?.hrs_mas_probable != null && t?.hrs_mas_probable !== ""
          ? `, más probable ${t.hrs_mas_probable}h`
          : "";
      return `${i + 1}. ${t?.nombre ?? "(sin nombre)"}: ${t?.hrs_min ?? 0}–${
        t?.hrs_max ?? 0
      } hrs${masProb}${desc}`;
    })
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Solicitud: ${nombre}\n\nTareas y horas estimadas:\n${tareasTxt}\n\n¿Las horas te parecen adecuadas?`,
      },
    ],
  });

  const block = resp.content.find((b) => b.type === "text");
  const opinion =
    block && block.type === "text" ? block.text.trim() : "Sin opinión de IA.";

  return NextResponse.json({ opinion });
}
