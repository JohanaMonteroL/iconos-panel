// GET /api/pagos/[id] — detalle de un pago.
// PATCH /api/pagos/[id] — edición (incluye activar/desactivar).
// DELETE /api/pagos/[id] — borrado definitivo (no está ligado a nada más).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PERIODICIDADES, TIPOS_PAGO, COMPROBANTE_TIPOS } from "@/lib/pagos/labels";
import { soloDigitos } from "@/lib/pagos/clabe";
import { esCorreoValido } from "@/lib/pagos/validacion";

export const runtime = "nodejs";

const FORMAS_PAGO = ["automatica", "manual"] as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa.from("pagos_proveedores").select("*").eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const errors: { path: string; message: string }[] = [];
  const patch: Record<string, any> = {};

  if ("nombre_pago" in body) {
    const n = String(body.nombre_pago ?? "").trim();
    if (!n) errors.push({ path: "nombre_pago", message: "Pon un nombre para el pago." });
    else patch.nombre_pago = n;
  }
  if ("empresa_contacto" in body) patch.empresa_contacto = body.empresa_contacto ? String(body.empresa_contacto).trim() : null;
  if ("periodicidad" in body) {
    if (!PERIODICIDADES.includes(body.periodicidad)) errors.push({ path: "periodicidad", message: "Periodicidad inválida." });
    else patch.periodicidad = body.periodicidad;
  }
  if ("monto" in body) {
    const m = Number(body.monto);
    if (!Number.isFinite(m) || m < 0) errors.push({ path: "monto", message: "Monto inválido." });
    else patch.monto = m;
  }
  if ("iva" in body) {
    const i = Number(body.iva);
    if (!Number.isFinite(i) || i < 0 || i > 100) {
      errors.push({ path: "iva", message: "IVA es un porcentaje entre 0 y 100." });
    } else {
      patch.iva = i;
    }
  }
  if ("total_a_pagar" in body) {
    const t = Number(body.total_a_pagar);
    if (!Number.isFinite(t) || t < 0) errors.push({ path: "total_a_pagar", message: "Total a pagar inválido." });
    else patch.total_a_pagar = t;
  }
  if ("forma_pago" in body) {
    if (!FORMAS_PAGO.includes(body.forma_pago)) errors.push({ path: "forma_pago", message: "Forma de pago inválida." });
    else patch.forma_pago = body.forma_pago;
  }
  if ("tipo_pago" in body) {
    if (body.tipo_pago && !TIPOS_PAGO.includes(body.tipo_pago)) errors.push({ path: "tipo_pago", message: "Tipo de pago inválido." });
    else patch.tipo_pago = body.tipo_pago || null;
  }
  if ("banco_o_cuenta" in body) patch.banco_o_cuenta = body.banco_o_cuenta ? soloDigitos(String(body.banco_o_cuenta)) : null;
  if ("titular" in body) patch.titular = body.titular ? String(body.titular).trim() : null;
  if ("correo_comprobante" in body) {
    const correo = body.correo_comprobante ? String(body.correo_comprobante).trim() : "";
    if (correo && !esCorreoValido(correo)) {
      errors.push({ path: "correo_comprobante", message: "Ese correo no se ve válido." });
    } else {
      patch.correo_comprobante = correo || null;
    }
  }
  if ("comprobante_tipo" in body) {
    if (!COMPROBANTE_TIPOS.includes(body.comprobante_tipo)) errors.push({ path: "comprobante_tipo", message: "Comprobante inválido." });
    else patch.comprobante_tipo = body.comprobante_tipo;
  }
  if ("referencia" in body) patch.referencia = body.referencia ? String(body.referencia).trim() : null;
  if ("notas" in body) patch.notas = body.notas ? String(body.notas).trim() : null;
  if ("activo" in body) patch.activo = !!body.activo;
  if ("orden" in body) patch.orden = Number(body.orden) || 0;
  if ("ultimo_pago_marcado" in body) {
    if (body.ultimo_pago_marcado === null) {
      patch.ultimo_pago_marcado = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(body.ultimo_pago_marcado))) {
      patch.ultimo_pago_marcado = String(body.ultimo_pago_marcado);
    } else {
      errors.push({ path: "ultimo_pago_marcado", message: "Fecha inválida." });
    }
  }
  if ("pasos" in body) {
    if (!Array.isArray(body.pasos)) {
      errors.push({ path: "pasos", message: "Formato de pasos inválido." });
    } else {
      patch.pasos = body.pasos
        .map((p: any) => ({
          id: String(p?.id ?? ""),
          texto: String(p?.texto ?? "").trim(),
          hecho: !!p?.hecho,
        }))
        .filter((p: { texto: string }) => p.texto);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();
  const { error } = await supa.from("pagos_proveedores").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/panel/pagos");
  revalidatePath(`/panel/pagos/${params.id}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  const supa = createSupabaseServiceClient();
  const { error } = await supa.from("pagos_proveedores").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/panel/pagos");
  return NextResponse.json({ ok: true });
}
