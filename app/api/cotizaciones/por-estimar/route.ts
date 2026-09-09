// POST /api/cotizaciones/por-estimar
// Crea el placeholder vacío que Johana llena a mano cuando una solicitud
// llega por un canal que no es el formulario de programadores (whatsapp,
// correo, llamada). Nace en estado "por_estimar" — sin tareas todavía — y
// sube a "pendiente_revision_interna" en cuanto /editar le agrega tareas.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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

  const nombre = String(body?.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json(
      { error: "Ponle un nombre a la solicitud." },
      { status: 422 }
    );
  }
  const proyectoClickupId = body?.proyecto_clickup_id
    ? String(body.proyecto_clickup_id).trim() || null
    : null;
  const proyectoNombre = body?.proyecto_nombre
    ? String(body.proyecto_nombre).trim() || null
    : null;
  const programadorId = body?.programador_id
    ? String(body.programador_id).trim() || null
    : null;
  const canalEntrada = body?.canal_entrada
    ? String(body.canal_entrada)
    : "otro";

  const supa = createSupabaseServiceClient();

  const { data: inserted, error: insErr } = await supa
    .from("cotizaciones")
    .insert({
      nombre,
      nombre_original: nombre,
      canal_entrada: canalEntrada,
      proyecto_clickup_id: proyectoClickupId,
      proyecto_nombre: proyectoNombre,
      programador_id: programadorId,
      estado: "por_estimar",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: `No se pudo crear la solicitud: ${insErr?.message}` },
      { status: 500 }
    );
  }

  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: inserted.id,
    tipo_accion: "creada_manual",
    metadata: { canal_entrada: canalEntrada },
  });

  revalidatePath("/panel/estimaciones");
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel");

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 });
}
