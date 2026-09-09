// POST /api/cotizaciones/[id]/aprobar-interno
//
// Sella el visto bueno interno de Iván (jefe_aprobacion_recibida_at) sin
// pasar por Slack — para cuando Johana ya sabe que está aprobado y quiere
// saltarse la notificación. Misma acción que hace handleAprobar() en
// app/api/slack/interactivity/route.ts cuando Iván aprueba desde Slack.
// No cambia `estado` — eso lo hace /cambiar-estado por separado.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const supa = createSupabaseServiceClient();

  const { error: updErr } = await supa
    .from("cotizaciones")
    .update({ jefe_aprobacion_recibida_at: new Date().toISOString() })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: "jefe_aprobacion_recibida",
    metadata: { aprobado_por: "Johana (manual, sin Slack)", via: "manual" },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  revalidatePath("/panel/cotizaciones");

  return NextResponse.json({ ok: true });
}
