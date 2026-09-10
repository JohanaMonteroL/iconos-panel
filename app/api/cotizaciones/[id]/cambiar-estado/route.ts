// Cambia el estado de la cotización (aprobada, cambios_solicitados, archivada, etc.).
// Registra en el log con acciones_cotizacion.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ESTADOS_COTIZACION } from "@/lib/estados";

export const runtime = "nodejs";

const ESTADOS_VALIDOS: readonly string[] = ESTADOS_COTIZACION;

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
  // "enviada" exige antes subir el PDF que se mandó al cliente — solo se
  // puede llegar a ese estado vía /api/cotizaciones/[id]/enviar-pdf.
  if (nuevo === "enviada") {
    return NextResponse.json(
      {
        error:
          "Para marcar como \"Enviada\" primero sube el PDF que se mandó al cliente.",
      },
      { status: 422 }
    );
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

  // Nota: ya no seteamos jefe_aprobacion_recibida_at aquí cuando nuevo ===
  // "aprobada" — ese estado ahora significa "el cliente aprobó". El visto
  // bueno interno de Iván es un timestamp aparte que solo se sella desde
  // Slack (handleAprobar) o manualmente si hiciera falta.
  const patch: Record<string, any> = { estado: nuevo };

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
