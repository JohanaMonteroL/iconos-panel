// POST /api/cobros — alta manual de un Cobro (sin cotización de por medio).
//
// origen "desarrollo" (default): crea el Cobro (sin cotizacion_id) y su
// primer Período ("Pago único"), listo_para_cobrar — desde ahí ya se puede
// dividir en parcialidades, subir factura, registrar pagos, etc. igual que
// cualquier otro Cobro (mismas tablas, mismo flujo).
//
// origen "soporte": cada proyecto tiene UN solo cobro de soporte
// (uq_cobros_soporte_por_proyecto), al que el cron le agrega un período por
// mes. El alta manual agrega un Período a ese cobro (lo crea igual que el
// cron si aún no existe); "por horas" usa la tarifa de soporte del proyecto.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { tarifaSoporte } from "@/lib/cobros/calculos";

export const runtime = "nodejs";

const MONEDAS_VALIDAS = ["MXN", "USD"];
const ORIGENES_VALIDOS = ["desarrollo", "soporte"] as const;
type Origen = (typeof ORIGENES_VALIDOS)[number];

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
  const origen = String(body?.origen ?? "desarrollo") as Origen;

  const errors: { path: string; message: string }[] = [];
  if (!titulo) errors.push({ path: "titulo", message: "Pon un nombre para el cobro." });
  if (!proyectoId) errors.push({ path: "proyecto_id", message: "Selecciona un proyecto." });
  if (!ORIGENES_VALIDOS.includes(origen)) {
    errors.push({ path: "origen", message: "Tipo de cobro inválido." });
  }
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

  let { data: proyecto, error: proyErr }: { data: any; error: any } = await supa
    .from("proyectos")
    .select("id, nombre, activo, precio_hora_venta, moneda_hora, soporte_tarifa_hora")
    .eq("id", proyectoId)
    .maybeSingle();
  // Sin la migración 0023 no existe soporte_tarifa_hora: se usa el costo/hora general.
  if (proyErr && /soporte_tarifa_hora/i.test(proyErr.message)) {
    ({ data: proyecto, error: proyErr } = await supa
      .from("proyectos")
      .select("id, nombre, activo, precio_hora_venta, moneda_hora")
      .eq("id", proyectoId)
      .maybeSingle());
  }
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

  const precioHora = origen === "soporte" ? tarifaSoporte(proyecto) : Number(proyecto.precio_hora_venta) || 0;
  let monto: number;
  if (horas != null) {
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

  if (origen === "soporte") {
    return crearPeriodoSoporte(supa, {
      proyecto,
      titulo,
      monto,
      moneda,
      horas,
      precioHora,
      programadorId,
      descripcion,
    });
  }

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

type Supa = ReturnType<typeof createSupabaseServiceClient>;

async function crearPeriodoSoporte(
  supa: Supa,
  d: {
    proyecto: { id: string; nombre: string };
    titulo: string;
    monto: number;
    moneda: string;
    horas: number | null;
    precioHora: number;
    programadorId: string | null;
    descripcion: string | null;
  }
) {
  const buscar = () =>
    supa
      .from("cobros")
      .select("id")
      .eq("proyecto_id", d.proyecto.id)
      .eq("origen", "soporte")
      .maybeSingle();

  const { data: existente, error: buscarErr } = await buscar();
  if (buscarErr) {
    return NextResponse.json({ error: buscarErr.message }, { status: 500 });
  }

  let cobroId = existente?.id as string | undefined;
  const cobroNuevo = !cobroId;
  if (!cobroId) {
    // Mismo formato que el cron (lib/cobros/generarSoporte.ts): el cobro es
    // el contrato abierto de soporte; el nombre capturado va en el período.
    const base = {
      origen: "soporte",
      proyecto_id: d.proyecto.id,
      cotizacion_id: null,
      titulo: `Soporte — ${d.proyecto.nombre}`,
      monto_total: null,
      moneda: d.moneda,
    };
    let { data: nuevo, error: insErr } = await supa
      .from("cobros")
      .insert({ ...base, programador_id: d.programadorId, descripcion: d.descripcion })
      .select("id")
      .maybeSingle();
    if (insErr && /(programador_id|descripcion)/i.test(insErr.message)) {
      ({ data: nuevo, error: insErr } = await supa.from("cobros").insert(base).select("id").maybeSingle());
    }
    // El cron pudo crearlo entre la búsqueda y el insert: se usa ese.
    if (insErr && /uq_cobros_soporte_por_proyecto|duplicate key/i.test(insErr.message)) {
      const { data: otro } = await buscar();
      if (otro) ({ data: nuevo, error: insErr } = { data: otro, error: null });
    }
    if (insErr || !nuevo) {
      return NextResponse.json(
        { error: insErr?.message || "No se pudo crear el cobro de soporte." },
        { status: 500 }
      );
    }
    cobroId = nuevo.id as string;
  }

  // `orden` = secuencia del período dentro del cobro (mismo criterio que
  // POST /api/cobros/[id]/periodos).
  const { count } = await supa
    .from("cobros_periodos")
    .select("id", { count: "exact", head: true })
    .eq("cobro_id", cobroId);

  const { data: periodo, error: insPeriodoErr } = await supa
    .from("cobros_periodos")
    .insert({
      cobro_id: cobroId,
      estado: "listo_para_cobrar",
      etiqueta: d.titulo,
      monto: d.monto,
      moneda: d.moneda,
      horas_trabajadas: d.horas,
      tarifa_hora_snapshot: d.horas != null ? d.precioHora : null,
      orden: count ?? 0,
    })
    .select("id")
    .maybeSingle();
  if (insPeriodoErr || !periodo) {
    return NextResponse.json(
      {
        error: cobroNuevo
          ? insPeriodoErr?.message || "El cobro de soporte se creó, pero no se pudo crear su período."
          : insPeriodoErr?.message || "No se pudo agregar el período al cobro de soporte.",
      },
      { status: 500 }
    );
  }

  revalidatePath("/panel/cobros");
  revalidatePath("/panel");

  return NextResponse.json(
    { ok: true, cobroId, periodoId: periodo.id, agregadoACobroExistente: !cobroNuevo },
    { status: 201 }
  );
}
