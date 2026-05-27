// POST /api/tickets/[id]/adjuntos
// Sube archivos a JIRA como attachments del ticket. Body: multipart/form-data
// con uno o varios campos "file".
//
// Límites: 5 archivos por request, 5 MB cada uno. Tipos permitidos
// validados a partir del Content-Type.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { addAttachment, jiraConfigured } from "@/lib/jira/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIME_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "text/plain",
  "application/zip",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!jiraConfigured()) {
    return NextResponse.json({ error: "JIRA no configurado" }, { status: 503 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  // 1) Resolver el jira_key a partir del id interno
  const supa = createSupabaseServiceClient();
  const { data: ticket, error: getErr } = await supa
    .from("tickets_jira")
    .select("jira_key")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !ticket) {
    return NextResponse.json(
      { error: "Ticket no encontrado" },
      { status: 404 }
    );
  }

  // 2) Leer multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body inválido — se espera multipart/form-data" },
      { status: 400 }
    );
  }
  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No se mandó ningún archivo" },
      { status: 422 }
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Máximo ${MAX_FILES} archivos por subida` },
      { status: 422 }
    );
  }

  // 3) Validar y subir uno por uno
  const subidos: string[] = [];
  const rechazados: { nombre: string; razon: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      rechazados.push({ nombre: f.name, razon: "Excede 5 MB" });
      continue;
    }
    if (!MIME_PERMITIDOS.includes(f.type)) {
      rechazados.push({
        nombre: f.name,
        razon: `Tipo no permitido (${f.type || "desconocido"})`,
      });
      continue;
    }
    try {
      const bytes = await f.arrayBuffer();
      await addAttachment(ticket.jira_key, {
        filename: f.name,
        contentType: f.type,
        bytes,
      });
      subidos.push(f.name);
    } catch (e: any) {
      rechazados.push({
        nombre: f.name,
        razon: e?.message?.slice(0, 200) ?? "Error subiendo a JIRA",
      });
    }
  }

  return NextResponse.json({ subidos, rechazados });
}
