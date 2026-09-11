// POST   /api/cobros/periodos/[id]/factura — sube el PDF o el XML de la
//        factura (parámetro `tipo`), cada uno independiente y opcional.
// DELETE /api/cobros/periodos/[id]/factura?tipo=pdf|xml — quita uno de los
//        dos, sin afectar al otro.
//
// Bucket privado "cobros-facturas" — igual que "cotizacion-pdfs", debe
// crearse a mano en el dashboard de Supabase antes de que esto funcione.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET = "cobros-facturas";
const TIPOS_VALIDOS = ["pdf", "xml"] as const;
type Tipo = (typeof TIPOS_VALIDOS)[number];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

function columnaPath(tipo: Tipo): "factura_pdf_path" | "factura_xml_path" {
  return tipo === "pdf" ? "factura_pdf_path" : "factura_xml_path";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const supa = createSupabaseServiceClient();

  const { data: periodo, error: getErr } = await supa
    .from("cobros_periodos")
    .select("id, factura_pdf_path, factura_xml_path")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !periodo) {
    return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body inválido — se espera multipart/form-data" },
      { status: 400 }
    );
  }

  const tipoRaw = String(form.get("tipo") ?? "");
  if (!TIPOS_VALIDOS.includes(tipoRaw as Tipo)) {
    return NextResponse.json({ error: "tipo debe ser 'pdf' o 'xml'" }, { status: 422 });
  }
  const tipo = tipoRaw as Tipo;

  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length !== 1) {
    return NextResponse.json({ error: "Sube un solo archivo" }, { status: 422 });
  }
  const file = files[0];
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo excede 15 MB" }, { status: 422 });
  }
  if (tipo === "pdf" && file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: `Tipo no permitido (${file.type}). Solo se acepta PDF.` },
      { status: 422 }
    );
  }

  const path = `${params.id}/${tipo}-${Date.now()}-${sanitizeFilename(file.name || `factura.${tipo}`)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supa.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || (tipo === "pdf" ? "application/pdf" : "application/xml"),
      upsert: false,
    });
  if (uploadErr) {
    const bucketFaltante = /bucket.*not.*found/i.test(uploadErr.message);
    return NextResponse.json(
      {
        error: bucketFaltante
          ? `No existe el bucket "${BUCKET}" en Supabase Storage. Créalo (privado) en el dashboard y vuelve a intentar.`
          : `No se pudo subir el archivo: ${uploadErr.message}`,
      },
      { status: 500 }
    );
  }

  // Si ya había un archivo de este mismo tipo, lo borramos del storage
  // para no dejar huérfanos (el registro solo guarda uno a la vez).
  const anteriorPath = tipo === "pdf" ? periodo.factura_pdf_path : periodo.factura_xml_path;
  if (anteriorPath) {
    await supa.storage.from(BUCKET).remove([anteriorPath]);
  }

  const { error: updErr } = await supa
    .from("cobros_periodos")
    .update({ [columnaPath(tipo)]: path })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  revalidatePath(`/panel/cobros/${params.id}`);
  return NextResponse.json({ ok: true, path });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const tipoRaw = req.nextUrl.searchParams.get("tipo") ?? "";
  if (!TIPOS_VALIDOS.includes(tipoRaw as Tipo)) {
    return NextResponse.json({ error: "tipo debe ser 'pdf' o 'xml'" }, { status: 422 });
  }
  const tipo = tipoRaw as Tipo;

  const supa = createSupabaseServiceClient();
  const { data: periodo, error: getErr } = await supa
    .from("cobros_periodos")
    .select("id, factura_pdf_path, factura_xml_path")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr || !periodo) {
    return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
  }

  const path = tipo === "pdf" ? periodo.factura_pdf_path : periodo.factura_xml_path;
  if (path) {
    await supa.storage.from(BUCKET).remove([path]);
  }

  const { error: updErr } = await supa
    .from("cobros_periodos")
    .update({ [columnaPath(tipo)]: null })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  revalidatePath(`/panel/cobros/${params.id}`);
  return NextResponse.json({ ok: true });
}
