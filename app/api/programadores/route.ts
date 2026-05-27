import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST: crear programador
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
  const slack_id = body?.slack_id ? String(body.slack_id).trim() : null;
  const correo = body?.correo ? String(body.correo).trim() : null;
  const precio_hora = Number(body?.precio_hora);

  if (!nombre) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 422 });
  }
  if (!Number.isFinite(precio_hora) || precio_hora < 0) {
    return NextResponse.json({ error: "Precio por hora inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  let resp: { data: any; error: any } = await supa
    .from("programadores")
    .insert({ nombre, slack_id, correo, precio_hora, activo: true })
    .select("id, nombre, slack_id, correo, precio_hora, activo")
    .single();

  // Fallback si la migración 0011 no se aplicó
  if (resp.error && /correo/i.test(resp.error.message)) {
    resp = await supa
      .from("programadores")
      .insert({ nombre, slack_id, precio_hora, activo: true })
      .select("id, nombre, slack_id, precio_hora, activo")
      .single();
  }
  const data = resp.data;
  const error = resp.error;

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: "Ya existe un programador con ese nombre" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/panel/settings/programadores");
  return NextResponse.json({ ok: true, programador: data });
}
