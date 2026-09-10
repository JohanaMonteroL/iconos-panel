// Activar / inactivar un proyecto. Nunca se borran registros de proyectos —
// esta es la única forma de "quitarlos" del listado activo.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  let body: { activo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof body.activo !== "boolean") {
    return NextResponse.json({ error: "Falta 'activo' (boolean)" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  const { error } = await supa
    .from("proyectos")
    .update({ activo: body.activo })
    .eq("id", params.id);
  if (error) {
    console.error("[proyectos] error cambiando estado:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/panel/proyectos/${params.id}`);
  revalidatePath("/panel/proyectos");
  return NextResponse.json({ ok: true });
}
