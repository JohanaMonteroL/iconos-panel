// Actualiza el precio_venta_hora de una cotización (snapshot).

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const precio = Number(body?.precio_venta_hora);
  if (!Number.isFinite(precio) || precio < 0) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  const { error } = await supa
    .from("cotizaciones")
    .update({ precio_venta_hora: precio })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message +
          (/precio_venta_hora/.test(error.message)
            ? " (¿falta correr la migración 0005?)"
            : ""),
      },
      { status: 500 }
    );
  }

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  return NextResponse.json({ ok: true });
}
