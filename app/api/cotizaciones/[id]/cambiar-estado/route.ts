// Cambia el estado de la cotización (aprobada, cambios_solicitados, archivada, etc.).
// Registra en el log con acciones_cotizacion.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ESTADOS_COTIZACION } from "@/lib/estados";

export const runtime = "nodejs";

const ESTADOS_VALIDOS: readonly string[] = ESTADOS_COTIZACION;

// Mismo cálculo que usa EstimacionForm.tsx para "Precio total que se
// envió": monto fijo si es tipo "fijo", o horas_envio × precio_hora_venta
// DEL PROYECTO si es por horas (no existe un "precio_venta_hora" propio de
// la cotización que se use para esto — esa columna es un snapshot aparte
// que solo alimenta el panel opcional de Análisis financiero/margen, casi
// nunca capturado). Usar ese campo aquí rechazaba cotizaciones reales que
// sí tienen precio visible en pantalla. null si todavía no hay datos
// suficientes.
function calcularMontoCotizacion(
  cot: {
    tipo_precio?: string | null;
    monto_fijo?: number | null;
    horas_envio?: number | null;
  },
  precioHoraVentaProyecto: number | null | undefined
): number | null {
  if (cot.tipo_precio === "fijo") {
    return cot.monto_fijo != null ? Number(cot.monto_fijo) : null;
  }
  if (
    cot.horas_envio != null &&
    precioHoraVentaProyecto != null &&
    Number(precioHoraVentaProyecto) > 0
  ) {
    return Number(cot.horas_envio) * Number(precioHoraVentaProyecto);
  }
  return null;
}

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

  const nuevo = String(body?.estado ?? "");
  if (!ESTADOS_VALIDOS.includes(nuevo)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 422 });
  }
  // "enviada" exige antes subir el PDF que se mandó al cliente — solo se
  // puede llegar a ese estado vía /api/cotizaciones/[id]/enviar-pdf.
  if (nuevo === "enviada") {
    return NextResponse.json(
      {
        error:
          "Para marcar como \"Enviada\" primero sube el PDF que se mandó al cliente.",
      },
      { status: 422 }
    );
  }
  const comentario = body?.comentario ? String(body.comentario) : null;
  const aprobadoPor = body?.aprobado_por ? String(body.aprobado_por) : null; // "johana" | "ivan"

  const supa = createSupabaseServiceClient();

  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select(
      "id, estado, nombre, tipo_precio, monto_fijo, horas_envio, proyecto_clickup_id"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  // Al pasar a "En espera de cobro" se crea el Cobro (y su primer Período)
  // en Cobros — necesitamos proyecto asignado y un monto calculable antes
  // de permitir el cambio. El monto por horas usa la tarifa del proyecto
  // (mismo cálculo que "Precio total que se envió" en EstimacionForm).
  let proyectoInfo: { precio_hora_venta: number | null; moneda_hora: string | null } | null = null;
  if (nuevo === "en_espera_de_cobro") {
    if (!cot.proyecto_clickup_id) {
      return NextResponse.json(
        {
          error:
            "Esta cotización no tiene un proyecto asignado — asígnale uno antes de mandarla a Cobros.",
        },
        { status: 422 }
      );
    }
    const { data: proyectoRow } = await supa
      .from("proyectos")
      .select("precio_hora_venta, moneda_hora")
      .eq("id", cot.proyecto_clickup_id)
      .maybeSingle();
    proyectoInfo = proyectoRow ?? null;

    if (calcularMontoCotizacion(cot, proyectoInfo?.precio_hora_venta) == null) {
      return NextResponse.json(
        {
          error:
            "No se pudo calcular el monto de esta cotización — revisa el tipo de precio, horas u horas de envío, o el precio por hora del proyecto.",
        },
        { status: 422 }
      );
    }
  }

  // Nota: ya no seteamos jefe_aprobacion_recibida_at aquí cuando nuevo ===
  // "aprobada" — ese estado ahora significa "el cliente aprobó". El visto
  // bueno interno de Iván es un timestamp aparte que solo se sella desde
  // Slack (handleAprobar) o manualmente si hiciera falta.
  const patch: Record<string, any> = { estado: nuevo };

  const { error: updErr } = await supa
    .from("cotizaciones")
    .update(patch)
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Efecto secundario: crear el Cobro (origen desarrollo) + su primer
  // Período ("Pago único") en Cobros. Idempotente — si ya existe un cobro
  // para esta cotización, no crea otro. Si las tablas de Cobros todavía no
  // existen (migración 0022 pendiente), solo se avisa por consola y se
  // deja seguir el cambio de estado normal: el backfill de la migración
  // 0024 recoge esta cotización más adelante.
  if (nuevo === "en_espera_de_cobro") {
    try {
      const { data: cobroExistente, error: existErr } = await supa
        .from("cobros")
        .select("id")
        .eq("cotizacion_id", params.id)
        .maybeSingle();
      if (existErr) throw existErr;

      if (!cobroExistente) {
        const monto = calcularMontoCotizacion(cot, proyectoInfo?.precio_hora_venta) as number;
        const moneda = proyectoInfo?.moneda_hora || "MXN";

        const { data: nuevoCobro, error: insCobroErr } = await supa
          .from("cobros")
          .insert({
            origen: "desarrollo",
            proyecto_id: cot.proyecto_clickup_id,
            cotizacion_id: params.id,
            titulo: cot.nombre,
            monto_total: monto,
            moneda,
          })
          .select("id")
          .maybeSingle();
        if (insCobroErr) throw insCobroErr;

        if (nuevoCobro?.id) {
          const { error: insPeriodoErr } = await supa.from("cobros_periodos").insert({
            cobro_id: nuevoCobro.id,
            estado: "listo_para_cobrar",
            etiqueta: "Pago único",
            monto,
            moneda,
          });
          if (insPeriodoErr) throw insPeriodoErr;
        }
      }
    } catch (e: any) {
      console.warn(
        "[cotizaciones] no se pudo crear el Cobro al pasar a en_espera_de_cobro (¿falta correr la migración 0022?):",
        e?.message || e
      );
    }
  }

  // Log
  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: `estado_${nuevo}`,
    metadata: {
      estado_anterior: cot.estado,
      estado_nuevo: nuevo,
      aprobado_por: aprobadoPor,
      comentario,
    },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/cobros");
  revalidatePath("/panel");

  return NextResponse.json({ ok: true });
}
