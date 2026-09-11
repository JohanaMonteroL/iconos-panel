// POST /api/cotizaciones/[id]/horas-envio
//
// Cambia el número de horas que verá el jefe en el mensaje de Slack y que
// quedan registradas como "horas_envio" en la cotización. Permite elegir
// entre min / pert / max / personalizado (min/pert/max ya incluyen el
// buffer vigente). Después regenera slack_text Y acomoda ese total
// proporcionalmente entre las tareas (hrs_enviadas) — reemplaza cualquier
// acomodo anterior, no se versiona.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildSlackText } from "@/lib/slack/format";
import { aplicarBuffer, distribuirHorasProporcional } from "@/lib/pert";

export const runtime = "nodejs";
export const maxDuration = 30;

const TIPOS = ["min", "pert", "max", "custom"] as const;
type Tipo = (typeof TIPOS)[number];

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

  const tipo = String(body?.tipo ?? "") as Tipo;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 422 });
  }

  const supa = createSupabaseServiceClient();

  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select(
      `id, nombre, horas_min, horas_max, buffer_porcentaje, contexto_sherlyn,
       programadores(nombre),
       tareas_estimacion(id, orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`
    )
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  // Mín/PERT/Máx incluyen el buffer vigente (Personalizado no — ahí Johana
  // ya escribe el número exacto que quiere mandar).
  const horasMinRaw = Number(cot.horas_min) || 0;
  const horasMaxRaw = Number(cot.horas_max) || 0;
  const pertRaw = Math.round(((horasMinRaw + horasMaxRaw) / 2) * 10) / 10;
  const conBuffer = aplicarBuffer(
    { totalMin: horasMinRaw, totalMax: horasMaxRaw, totalEsperado: pertRaw },
    Number((cot as any).buffer_porcentaje) || 0
  );

  // Calcular horas_envio según el tipo elegido
  let horasEnvio = 0;
  if (tipo === "min") horasEnvio = conBuffer.totalMin;
  else if (tipo === "max") horasEnvio = conBuffer.totalMax;
  else if (tipo === "pert") horasEnvio = conBuffer.totalEsperado;
  else if (tipo === "custom") {
    const c = Number(body?.custom);
    if (!Number.isFinite(c) || c <= 0) {
      return NextResponse.json(
        { error: "Para tipo 'custom' falta un número válido en `custom`" },
        { status: 422 }
      );
    }
    horasEnvio = Math.round(c * 10) / 10;
  }

  // Regenerar slack_text con las nuevas horas
  const programadorNombre =
    (cot as any).programadores?.nombre ?? "—";
  const tareasOrdenadas = ((cot as any).tareas_estimacion ?? []).sort(
    (a: any, b: any) => a.orden - b.orden
  );
  const puntos = tareasOrdenadas
    .slice(0, 4)
    .map((t: any) => t.nombre_limpio || "")
    .filter(Boolean);
  const descripcionCorta =
    (cot.contexto_sherlyn ?? "").split(/[.\n]/)[0]?.trim() || cot.nombre;

  const slackTextNuevo = buildSlackText({
    nombreCotizacion: cot.nombre,
    proyecto: null,
    programador: programadorNombre,
    horasEnvio,
    bufferPct: 0,
    descripcionCorta,
    puntosClave: puntos,
    notas: null,
    clickupUrl: null,
  });

  // Persistir
  const { error: updErr } = await supa
    .from("cotizaciones")
    .update({
      horas_envio: horasEnvio,
      horas_envio_tipo: tipo,
      slack_text: slackTextNuevo,
    })
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Acomodar ese total proporcionalmente entre las tareas (hrs_enviadas) —
  // reemplaza cualquier acomodo anterior. Actualiza cada fila por separado
  // (no upsert: un upsert por columnas parciales exige igual todas las
  // columnas NOT NULL de la tabla, aunque el conflicto resuelva en update).
  // Si la columna todavía no existe (migración 0020 pendiente), no bloquea
  // el resto del guardado.
  if (tareasOrdenadas.length > 0) {
    const horasPorTarea = distribuirHorasProporcional(tareasOrdenadas, horasEnvio);
    const resultados = await Promise.all(
      tareasOrdenadas.map((t: any, i: number) =>
        supa
          .from("tareas_estimacion")
          .update({ hrs_enviadas: horasPorTarea[i] ?? 0 })
          .eq("id", t.id)
      )
    );
    const tareasErr = resultados.find((r) => r.error)?.error;
    if (tareasErr && !/hrs_enviadas/i.test(tareasErr.message)) {
      return NextResponse.json({ error: tareasErr.message }, { status: 500 });
    }
  }

  // Log
  await supa.from("acciones_cotizacion").insert({
    cotizacion_id: params.id,
    tipo_accion: "horas_envio_cambiada",
    metadata: { tipo, horas_envio: horasEnvio },
  });

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  return NextResponse.json({
    ok: true,
    horas_envio: horasEnvio,
  });
}
