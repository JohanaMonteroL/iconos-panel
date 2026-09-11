// POST /api/cobros/periodos/[id]/pagos
//
// Registra un pago/depósito real dentro de un período. El comprobante es
// opcional (multipart/form-data para poder adjuntarlo, igual que las
// facturas). `monto`, `fecha` y `notas` viajan como campos de texto del
// mismo FormData.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET = "cobros-facturas";

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
  const { data: periodo, error: getErr } = await supa
    .from("cobros_periodos")
    .select("id")
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

  const monto = Number(form.get("monto"));
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 422 });
  }
  const fecha = String(form.get("fecha") ?? "").trim();
  if (!fecha) {
    return NextResponse.json({ error: "La fecha es requerida" }, { status: 422 });
  }
  const notasRaw = form.get("notas");
  const notas = typeof notasRaw === "string" && notasRaw.trim() ? notasRaw.trim() : null;

  let comprobantePath: string | null = null;
  const comprobante = form.get("comprobante");
  if (comprobante instanceof File && comprobante.size > 0) {
    if (comprobante.size > MAX_BYTES) {
      return NextResponse.json({ error: "El comprobante excede 15 MB" }, { status: 422 });
    }
    const path = `${params.id}/pago-${Date.now()}-${sanitizeFilename(comprobante.name || "comprobante")}`;
    const buffer = Buffer.from(await comprobante.arrayBuffer());
    const { error: uploadErr } = await supa.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: comprobante.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) {
      const bucketFaltante = /bucket.*not.*found/i.test(uploadErr.message);
      return NextResponse.json(
        {
          error: bucketFaltante
            ? `No existe el bucket "${BUCKET}" en Supabase Storage. Créalo (privado) en el dashboard y vuelve a intentar.`
            : `No se pudo subir el comprobante: ${uploadErr.message}`,
        },
        { status: 500 }
      );
    }
    comprobantePath = path;
  }

  const { data: pago, error: insErr } = await supa
    .from("cobros_pagos")
    .insert({
      periodo_id: params.id,
      monto,
      fecha,
      comprobante_path: comprobantePath,
      notas,
    })
    .select("id")
    .maybeSingle();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  revalidatePath(`/panel/cobros/${params.id}`);
  revalidatePath("/panel/cobros");
  return NextResponse.json({ ok: true, pago });
}
