// Cambia el estado de la cotización (aprobada, cambios_solicitados, archivada, etc.).
// Registra en el log con acciones_cotizacion.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ESTADOS_VALIDOS = [
  "pendiente_revisar",
  "esperando_aprobacion",
  "aprobada",
  "cambios_solicitados",
  "aprobado_cliente",
  "enviada_cliente",
  "en_desarrollo",
  "finalizado",
  "archivada",
];

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nuevo = String(body?.estado ?? "");
  if (!ESTADOS_VALIDOS.includes(nuevo)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 422 });
  }
  const comentario = body?.comentario ? String(body.comentario) : null;
  const aprobadoPor = body?.aprobado_por ? String(body.aprobado_por) : null; // "johana" | "ivan"

  const supa = createSupabaseServiceClient();

  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select("id, estado")
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  const patch: Record<string, any> = { estado: nuevo };
  if (nuevo === "aprobada") {
    patch.jefe_aprobacion_recibida_at = new Date().toISOString();
  }

  const { error: updErr } = await supa
    .from("cotizaciones")
    .update(patch)
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Log
  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: `estado_${nuevo}`,
    metadata: {
      estado_anterior: cot.estado,
      estado_nuevo: nuevo,
      aprobado_por: aprobadoPor,
      comentario,
    },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel");

  return NextResponse.json({ ok: true });
}
