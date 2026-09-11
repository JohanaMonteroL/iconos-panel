// POST /api/cobros/[id]/dividir-parcialidades
//
// Reemplaza TODOS los períodos actuales de un Cobro por N períodos nuevos
// ("Parcialidad 1 de N", "Parcialidad 2 de N"...), repartiendo el monto
// total del contrato en partes iguales o en montos personalizados (deben
// sumar exactamente el total). Solo aplica a Cobros con monto_total
// definido (origen "desarrollo") — Soporte es recurrente/abierto y no
// tiene un total que repartir.
//
// Guardado de seguridad: si cualquier período actual ya tiene pagos
// registrados o factura (PDF/XML) cargada, se rechaza — habría que decidir
// a mano qué hacer con esos datos, así que se pide editar/eliminar
// manualmente en su lugar.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PARCIALIDADES = 24;

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

  const n = Number(body?.n);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARCIALIDADES) {
    return NextResponse.json(
      { error: `El número de parcialidades debe ser entre 1 y ${MAX_PARCIALIDADES}` },
      { status: 422 }
    );
  }
  const modo = body?.modo === "personalizado" ? "personalizado" : "igual";
  const montosPersonalizados: number[] | null =
    modo === "personalizado" && Array.isArray(body?.montos)
      ? body.montos.map((m: any) => Number(m))
      : null;
  if (modo === "personalizado") {
    if (!montosPersonalizados || montosPersonalizados.length !== n) {
      return NextResponse.json(
        { error: "Faltan montos personalizados para cada parcialidad" },
        { status: 422 }
      );
    }
    if (montosPersonalizados.some((m) => !Number.isFinite(m) || m < 0)) {
      return NextResponse.json({ error: "Hay un monto inválido" }, { status: 422 });
    }
  }

  const supa = createSupabaseServiceClient();

  const { data: cobro, error: cobroErr } = await supa
    .from("cobros")
    .select("id, monto_total, moneda")
    .eq("id", params.id)
    .maybeSingle();
  if (cobroErr || !cobro) {
    return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
  }
  if (cobro.monto_total == null) {
    return NextResponse.json(
      {
        error:
          "Este Cobro no tiene un monto total definido (es de Soporte, recurrente) — no hay un total que repartir.",
      },
      { status: 422 }
    );
  }
  const total = Number(cobro.monto_total);

  if (modo === "personalizado" && montosPersonalizados) {
    const suma = montosPersonalizados.reduce((acc, m) => acc + m, 0);
    if (Math.abs(suma - total) > 0.01) {
      return NextResponse.json(
        {
          error: `Los montos personalizados suman ${suma.toFixed(2)} y deben sumar exactamente el total del contrato (${total.toFixed(2)}).`,
        },
        { status: 422 }
      );
    }
  }

  const { data: periodosActuales, error: periodosErr } = await supa
    .from("cobros_periodos")
    .select("id, factura_pdf_path, factura_xml_path")
    .eq("cobro_id", params.id);
  if (periodosErr) {
    return NextResponse.json({ error: periodosErr.message }, { status: 500 });
  }
  const idsActuales = (periodosActuales ?? []).map((p) => p.id);
  const tieneFactura = (periodosActuales ?? []).some(
    (p) => p.factura_pdf_path || p.factura_xml_path
  );
  if (tieneFactura) {
    return NextResponse.json(
      {
        error:
          "Ya hay una factura (PDF o XML) cargada en un período de este Cobro — no se puede dividir automáticamente. Edita o elimina los períodos manualmente.",
      },
      { status: 409 }
    );
  }
  if (idsActuales.length > 0) {
    const { count: pagosCount } = await supa
      .from("cobros_pagos")
      .select("id", { count: "exact", head: true })
      .in("periodo_id", idsActuales);
    if (pagosCount) {
      return NextResponse.json(
        {
          error:
            "Ya hay pagos registrados en este Cobro — no se puede dividir automáticamente. Edita o elimina los períodos manualmente.",
        },
        { status: 409 }
      );
    }
  }

  // Montos: partes iguales con centavos exactos (el último absorbe el
  // residuo de redondeo para que la suma cuadre siempre con el total).
  let montos: number[];
  if (modo === "personalizado" && montosPersonalizados) {
    montos = montosPersonalizados;
  } else {
    const base = Math.floor((total / n) * 100) / 100;
    montos = Array.from({ length: n }, (_, i) =>
      i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base
    );
  }

  if (idsActuales.length > 0) {
    const { error: delErr } = await supa
      .from("cobros_periodos")
      .delete()
      .eq("cobro_id", params.id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
  }

  const nuevos = montos.map((monto, i) => ({
    cobro_id: params.id,
    estado: "listo_para_cobrar",
    etiqueta: n === 1 ? "Pago único" : `Parcialidad ${i + 1} de ${n}`,
    monto,
    moneda: cobro.moneda ?? "MXN",
    orden: i,
  }));

  const { data: periodosCreados, error: insErr } = await supa
    .from("cobros_periodos")
    .insert(nuevos)
    .select("id, etiqueta");
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  revalidatePath("/panel/cobros");
  revalidatePath(`/panel/cobros/${params.id}`);

  return NextResponse.json({ ok: true, periodos: periodosCreados });
}
