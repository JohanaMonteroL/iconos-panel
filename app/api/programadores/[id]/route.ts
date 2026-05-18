import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// PATCH: actualizar programador
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

  const patch: Record<string, any> = {};
  if (typeof body.nombre === "string") {
    const n = body.nombre.trim();
    if (!n)
      return NextResponse.json({ error: "Nombre no puede estar vacío" }, { status: 422 });
    patch.nombre = n;
  }
  if ("slack_id" in body) patch.slack_id = body.slack_id ? String(body.slack_id).trim() : null;
  if (body.precio_hora !== undefined) {
    const p = Number(body.precio_hora);
    if (!Number.isFinite(p) || p < 0) {
      return NextResponse.json({ error: "Precio por hora inválido" }, { status: 422 });
    }
    patch.precio_hora = p;
  }
  if (typeof body.activo === "boolean") patch.activo = body.activo;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  const { error } = await supa.from("programadores").update(patch).eq("id", params.id);
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: "Ya existe otro programador con ese nombre" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/panel/settings/programadores");
  return NextResponse.json({ ok: true });
}
