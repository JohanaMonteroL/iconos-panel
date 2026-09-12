// POST /api/cobros — alta manual de un Cobro (sin cotización ni Soporte de
// por medio). Crea el Cobro (origen "desarrollo", sin cotizacion_id) y su
// primer Período ("Pago único"), listo_para_cobrar — desde ahí ya se puede
// dividir en parcialidades, subir factura, registrar pagos, etc. igual que
// cualquier otro Cobro (mismas tablas, mismo flujo).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MONEDAS_VALIDAS = ["MXN", "USD"];

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

  const titulo = String(body?.titulo ?? "").trim();
  const proyectoId = String(body?.proyecto_id ?? "").trim();
  const programadorId = body?.programador_id ? String(body.programador_id).trim() : null;
  const descripcion = body?.descripcion ? String(body.descripcion).trim() : null;
  const horasRaw = body?.horas;
  const montoRaw = body?.monto;
  const monedaOverride = body?.moneda ? String(body.moneda).toUpperCase() : null;

  const errors: { path: string; message: string }[] = [];
  if (!titulo) errors.push({ path: "titulo", message: "Pon un nombre para el cobro." });
  if (!proyectoId) errors.push({ path: "proyecto_id", message: "Selecciona un proyecto." });
  if (monedaOverride && !MONEDAS_VALIDAS.includes(monedaOverride)) {
    errors.push({ path: "moneda", message: "Moneda inválida." });
  }

  const horas =
    horasRaw != null && horasRaw !== "" && Number.isFinite(Number(horasRaw)) && Number(horasRaw) > 0
      ? Number(horasRaw)
      : null;
  const montoDirecto =
    montoRaw != null && montoRaw !== "" && Number.isFinite(Number(montoRaw)) && Number(montoRaw) > 0
      ? Number(montoRaw)
      : null;
  if (horas == null && montoDirecto == null) {
    errors.push({ path: "monto", message: "Captura las horas o un monto directo." });
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();

  const { data: proyecto, error: proyErr } = await supa
    .from("proyectos")
    .select("id, nombre, activo, precio_hora_venta, moneda_hora")
    .eq("id", proyectoId)
    .maybeSingle();
  if (proyErr || !proyecto || !proyecto.activo) {
    return NextResponse.json(
      { errors: [{ path: "proyecto_id", message: "Proyecto no válido." }] },
      { status: 422 }
    );
  }

  if (programadorId) {
    const { data: prog, error: progErr } = await supa
      .from("programadores")
      .select("id, activo")
      .eq("id", programadorId)
      .maybeSingle();
    if (progErr || !prog || !prog.activo) {
      return NextResponse.json(
        { errors: [{ path: "programador_id", message: "Programador no válido." }] },
        { status: 422 }
      );
    }
  }

  let monto: number;
  if (horas != null) {
    const precioHora = Number(proyecto.precio_hora_venta) || 0;
    if (precioHora <= 0) {
      return NextResponse.json(
        {
          errors: [
            {
              path: "horas",
              message: `"${proyecto.nombre}" no tiene costo por hora configurado — captura un monto directo o configúralo en el catálogo de Proyectos.`,
            },
          ],
        },
        { status: 422 }
      );
    }
    monto = Math.round(horas * precioHora * 100) / 100;
  } else {
    monto = montoDirecto as number;
  }

  const moneda = monedaOverride || proyecto.moneda_hora || "MXN";

  let { data: nuevoCobro, error: insCobroErr } = await supa
    .from("cobros")
    .insert({
      origen: "desarrollo",
      proyecto_id: proyecto.id,
      cotizacion_id: null,
      titulo,
      monto_total: monto,
      moneda,
      programador_id: programadorId,
      descripcion,
      horas,
    })
    .select("id")
    .maybeSingle();
  // Degradación si la migración 0026 (programador_id/descripcion/horas)
  // todavía no se corrió — se guarda igual, solo sin esos 3 campos.
  if (insCobroErr && /(programador_id|descripcion|horas)/i.test(insCobroErr.message)) {
    ({ data: nuevoCobro, error: insCobroErr } = await supa
      .from("cobros")
      .insert({
        origen: "desarrollo",
        proyecto_id: proyecto.id,
        cotizacion_id: null,
        titulo,
        monto_total: monto,
        moneda,
      })
      .select("id")
      .maybeSingle());
  }
  if (insCobroErr || !nuevoCobro) {
    return NextResponse.json(
      { error: insCobroErr?.message || "No se pudo crear el cobro." },
      { status: 500 }
    );
  }

  const { data: periodo, error: insPeriodoErr } = await supa
    .from("cobros_periodos")
    .insert({
      cobro_id: nuevoCobro.id,
      estado: "listo_para_cobrar",
      etiqueta: "Pago único",
      monto,
      moneda,
    })
    .select("id")
    .maybeSingle();
  if (insPeriodoErr || !periodo) {
    return NextResponse.json(
      { error: insPeriodoErr?.message || "El cobro se creó, pero no se pudo crear su período." },
      { status: 500 }
    );
  }

  revalidatePath("/panel/cobros");
  revalidatePath("/panel");

  return NextResponse.json({ ok: true, cobroId: nuevoCobro.id, periodoId: periodo.id }, { status: 201 });
}
