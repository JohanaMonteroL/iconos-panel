// DELETE /api/estimaciones/[id] — borrado permanente
// PATCH  /api/estimaciones/[id] — cambia el estado (descartar / restaurar)

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ESTADOS_VALIDOS = ["recibida", "procesada_ia", "descartada"];

export async function PATCH(
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

  const estado = String(body?.estado ?? "");
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json(
      { error: `Estado inválido. Permitidos: ${ESTADOS_VALIDOS.join(", ")}` },
      { status: 422 }
    );
  }

  const supa = createSupabaseServiceClient();
  const { error } = await supa
    .from("estimaciones_formulario")
    .update({ estado })
    .eq("id", params.id);

  if (error) {
    console.error("[estimaciones PATCH] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/panel/estimaciones");
  revalidatePath(`/panel/estimaciones/${params.id}`);
  revalidatePath("/panel");
  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  // 1) Verificar que existe
  const { data: est, error: getErr } = await supa
    .from("estimaciones_formulario")
    .select("id, cotizacion_ref")
    .eq("id", params.id)
    .maybeSingle();

  if (getErr) {
    console.error("[estimaciones DELETE] no se pudo leer:", getErr);
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }
  if (!est) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  // 2) Si tiene cotización, bloquear (la BD también lo haría por FK)
  if (est.cotizacion_ref) {
    return NextResponse.json(
      {
        error:
          "Esta estimación ya fue convertida en cotización. No se puede eliminar.",
      },
      { status: 409 }
    );
  }

  // 3) Borrar. Usamos .select() para que devuelva las filas borradas y
  //    confirmar visualmente que sí se eliminó algo.
  const { data: borradas, error: delErr } = await supa
    .from("estimaciones_formulario")
    .delete()
    .eq("id", params.id)
    .select("id");

  if (delErr) {
    console.error("[estimaciones DELETE] supabase error:", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (!borradas || borradas.length === 0) {
    // Esto sucede si RLS lo está bloqueando (service_role debería pasar,
    // pero si por alguna razón no, se ve aquí).
    return NextResponse.json(
      {
        error:
          "El delete se ejecutó pero ningún registro fue afectado. " +
          "Probable problema de RLS en estimaciones_formulario — verifica políticas.",
      },
      { status: 500 }
    );
  }

  revalidatePath("/panel/estimaciones");
  revalidatePath("/panel");
  return NextResponse.json({ ok: true, deleted: borradas.length });
}
