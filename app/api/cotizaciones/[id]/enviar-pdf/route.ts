// POST /api/cotizaciones/[id]/enviar-pdf
//
// Paso nuevo del flujo unificado: para marcar una cotización como "Enviada"
// (al cliente) hay que subir el PDF que se mandó. Este endpoint:
//   1) Valida que venga un único PDF (máx 15MB) — mismo modelo de
//      validación que app/api/tickets/[id]/adjuntos/route.ts.
//   2) Lo sube al bucket privado "cotizacion-pdfs" de Supabase Storage.
//   3) Calcula y guarda el detalle de envío (horas totales, quién estimó,
//      costo aproximado, fecha).
//   4) Cambia estado -> "enviada" y loguea en acciones_cotizacion (esto
//      alimenta el historial de fechas reusando el log ya existente).
//
// El bucket "cotizacion-pdfs" debe existir de antemano en Supabase Storage
// (privado) — no lo crea este endpoint ni ninguna migración de este cambio,
// hay que crearlo a mano una vez en el dashboard de Supabase.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET = "cotizacion-pdfs";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
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

  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select(
      "id, estado, horas_min, horas_max, horas_envio, programadores(nombre, precio_hora)"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
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

  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No se mandó ningún PDF" }, { status: 422 });
  }
  if (files.length > 1) {
    return NextResponse.json(
      { error: "Sube un solo PDF por envío" },
      { status: 422 }
    );
  }
  const file = files[0];

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El PDF excede 15 MB" }, { status: 422 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: `Tipo no permitido (${file.type}). Solo se acepta PDF.` },
      { status: 422 }
    );
  }

  const programador = (cot as any).programadores as
    | { nombre: string; precio_hora: number }
    | null;
  const precioHora = programador?.precio_hora ?? 0;
  const horasTotales =
    cot.horas_envio != null
      ? Number(cot.horas_envio)
      : Math.round(((cot.horas_min + cot.horas_max) / 2) * 10) / 10;
  const costoAproximado = Math.round(horasTotales * precioHora * 100) / 100;

  const path = `${params.id}/${Date.now()}-${sanitizeFilename(file.name || "cotizacion.pdf")}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supa.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadErr) {
    const bucketFaltante = /bucket.*not.*found/i.test(uploadErr.message);
    return NextResponse.json(
      {
        error: bucketFaltante
          ? `No existe el bucket "${BUCKET}" en Supabase Storage. Créalo (privado) en el dashboard y vuelve a intentar.`
          : `No se pudo subir el PDF: ${uploadErr.message}`,
      },
      { status: 500 }
    );
  }

  const envioFecha = new Date().toISOString();
  const { error: updErr } = await supa
    .from("cotizaciones")
    .update({
      envio_pdf_path: path,
      envio_pdf_nombre_original: file.name || "cotizacion.pdf",
      envio_horas_totales: horasTotales,
      envio_costo_aproximado: costoAproximado,
      envio_estimado_por: programador?.nombre ?? null,
      envio_fecha: envioFecha,
      estado: "enviada",
    })
    .eq("id", params.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: "estado_enviada",
    metadata: {
      estado_anterior: cot.estado,
      estado_nuevo: "enviada",
      pdf_nombre: file.name,
      horas_totales: horasTotales,
      costo_aproximado: costoAproximado,
      estimado_por: programador?.nombre ?? null,
    },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel");

  return NextResponse.json({
    ok: true,
    envio: {
      pdf_path: path,
      pdf_nombre_original: file.name,
      horas_totales: horasTotales,
      costo_aproximado: costoAproximado,
      estimado_por: programador?.nombre ?? null,
      fecha: envioFecha,
    },
  });
}
