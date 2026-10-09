// POST /api/cobros/periodos/[id]/reordenar
// Body: { antes_id: string | null, despues_id: string | null }
//
// Cambia la posición de la tarjeta dentro de su carril del tablero. Se
// llama después de /cambiar-estado cuando la tarjeta además cambió de
// carril. Lógica en lib/tableros/orden.ts.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ErrorOrden, leerVecinas, reordenarEnCarril } from "@/lib/tableros/orden";

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

  const { antesId, despuesId } = leerVecinas(body);
  try {
    await reordenarEnCarril(createSupabaseServiceClient(), "cobros_periodos", params.id, antesId, despuesId);
  } catch (e) {
    const status = e instanceof ErrorOrden ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }

  revalidatePath("/panel/cobros");
  return NextResponse.json({ ok: true });
}
