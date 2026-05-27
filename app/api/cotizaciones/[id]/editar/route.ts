// Editar campos de una cotización existente.
// Cualquier cambio se replica al ticket de ClickUp (si tiene clickup_ticket_id)
// y se registra en acciones_cotizacion (log).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildSlackText, buildSlackTextFijo } from "@/lib/slack/format";
import { syncCotizacionConClickUp } from "@/lib/clickup/sync";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  nombre?: string;
  contexto_sherlyn?: string;
  borrador_correo?: string;
  ia_recomendacion?: string;
  horas_min?: number;
  horas_max?: number;
  precio_venta_hora?: number | null;
  monto_fijo?: number | null;
  proyecto_clickup_id?: string | null;
  proyecto_nombre?: string | null;
  // Tareas: array completo. Si viene, se reemplazan.
  tareas?: Array<{
    id?: string;
    orden: number;
    nombre_limpio: string;
    descripcion_limpia: string | null;
    hrs_min: number;
    hrs_max: number;
  }>;
  comentario?: string;
};

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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supa = createSupabaseServiceClient();

  // Fetch full state — necesario para regenerar slack_text con datos vigentes.
  // Hago un select resiliente a migraciones pendientes.
  // Select resiliente — si la migración 0005 (precio_venta_hora) no se corrió,
  // reintentamos sin ese campo.
  const baseSel = `id, nombre, horas_min, horas_max, clickup_ticket_id, contexto_sherlyn,
       programadores(nombre)`;
  const withPrecio = baseSel.replace(
    "contexto_sherlyn,",
    "contexto_sherlyn, precio_venta_hora,"
  );

  let cotResp = await supa
    .from("cotizaciones")
    .select(withPrecio)
    .eq("id", params.id)
    .maybeSingle();
  if (cotResp.error && /precio_venta_hora/i.test(cotResp.error.message)) {
    cotResp = await supa
      .from("cotizaciones")
      .select(baseSel)
      .eq("id", params.id)
      .maybeSingle();
  }
  const cot = cotResp.data as
    | (Record<string, any> & { programadores?: { nombre: string } | null })
    | null;
  const cotErr = cotResp.error;

  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }

  const patch: Record<string, any> = {};
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};

  const setIfDiff = (campo: string, nuevoVal: unknown, viejoVal: unknown) => {
    if (nuevoVal !== undefined && nuevoVal !== viejoVal) {
      patch[campo] = nuevoVal;
      cambios[campo] = { antes: viejoVal, despues: nuevoVal };
    }
  };

  setIfDiff("nombre", body.nombre, (cot as any).nombre);
  setIfDiff("horas_min", body.horas_min, (cot as any).horas_min);
  setIfDiff("horas_max", body.horas_max, (cot as any).horas_max);
  if (body.contexto_sherlyn !== undefined) patch.contexto_sherlyn = body.contexto_sherlyn;
  if (body.borrador_correo !== undefined) patch.borrador_correo = body.borrador_correo;
  if (body.ia_recomendacion !== undefined) patch.ia_recomendacion = body.ia_recomendacion;

  // precio_venta_hora — solo si vino en el body. Null lo limpia.
  if (body.precio_venta_hora !== undefined) {
    setIfDiff(
      "precio_venta_hora",
      body.precio_venta_hora,
      (cot as any).precio_venta_hora ?? null
    );
  }

  // monto_fijo (solo para cotizaciones de tipo fijo)
  if (body.monto_fijo !== undefined) {
    setIfDiff(
      "monto_fijo",
      body.monto_fijo,
      (cot as any).monto_fijo ?? null
    );
  }

  // proyecto_clickup_id + proyecto_nombre — actualiza el ClickUp custom field
  // del proyecto al final del flujo de edición (vía syncCotizacionConClickUp).
  if (body.proyecto_clickup_id !== undefined) {
    setIfDiff(
      "proyecto_clickup_id",
      body.proyecto_clickup_id,
      (cot as any).proyecto_clickup_id ?? null
    );
  }
  if (body.proyecto_nombre !== undefined) {
    setIfDiff(
      "proyecto_nombre",
      body.proyecto_nombre,
      (cot as any).proyecto_nombre ?? null
    );
  }

  if (Object.keys(patch).length > 0) {
    let { error: updErr } = await supa
      .from("cotizaciones")
      .update(patch)
      .eq("id", params.id);

    // Si la migración 0005 no existe, reintentar sin precio_venta_hora.
    if (updErr && /precio_venta_hora/i.test(updErr.message)) {
      const { precio_venta_hora: _drop, ...resto } = patch;
      void _drop;
      updErr = (
        await supa
          .from("cotizaciones")
          .update(resto)
          .eq("id", params.id)
      ).error;
    }
    // Si la migración 0010 no existe, reintentar sin proyecto_nombre.
    if (updErr && /proyecto_nombre/i.test(updErr.message)) {
      const { proyecto_nombre: _drop2, ...resto } = patch;
      void _drop2;
      updErr = (
        await supa
          .from("cotizaciones")
          .update(resto)
          .eq("id", params.id)
      ).error;
    }

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  // Reemplazar tareas si vienen
  if (Array.isArray(body.tareas)) {
    await supa.from("tareas_estimacion").delete().eq("cotizacion_id", params.id);
    const rows = body.tareas.map((t, i) => ({
      cotizacion_id: params.id,
      orden: t.orden ?? i,
      nombre_original: t.nombre_limpio,
      nombre_limpio: t.nombre_limpio,
      descripcion_limpia: t.descripcion_limpia ?? null,
      descripcion_original: t.descripcion_limpia ?? null,
      hrs_min: t.hrs_min || 0,
      hrs_max: t.hrs_max || 0,
    }));
    if (rows.length > 0) {
      await supa.from("tareas_estimacion").insert(rows);
    }
    cambios.tareas = { antes: "(set previo)", despues: `${rows.length} tareas` };
  }

  // La actualización a ClickUp se hace MÁS ABAJO, después de refrescar el
  // estado y de regenerar slack_text, para que mande la versión vigente.
  let clickup_warning: string | null = null;

  // Recalcular horas_envio y regenerar slack_text con los valores VIGENTES.
  // Para esto leemos el estado actual (post-update) y reconstruimos.
  // Leemos también horas_envio para PRESERVAR la selección de Johana.
  // Si no existe la columna (migración 0004 sin correr), fallback a PERT.
  const refreshedSel = `nombre, horas_min, horas_max, horas_envio, contexto_sherlyn, clickup_ticket_id,
       tipo_precio, monto_fijo,
       programadores(nombre),
       tareas_estimacion(orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`;
  let refreshed = await supa
    .from("cotizaciones")
    .select(refreshedSel)
    .eq("id", params.id)
    .maybeSingle();
  if (refreshed.error && /(tipo_precio|monto_fijo)/i.test(refreshed.error.message)) {
    refreshed = await supa
      .from("cotizaciones")
      .select(refreshedSel.replace("tipo_precio, monto_fijo,\n       ", ""))
      .eq("id", params.id)
      .maybeSingle();
  }
  if (refreshed.error && /horas_envio/i.test(refreshed.error.message)) {
    refreshed = await supa
      .from("cotizaciones")
      .select(refreshedSel.replace("horas_envio, ", "").replace("tipo_precio, monto_fijo,\n       ", ""))
      .eq("id", params.id)
      .maybeSingle();
  }

  const r = refreshed.data as any;
  if (r) {
    const esFijo = r.tipo_precio === "fijo";

    // Conservar horas_envio si ya está guardado. Solo si no existe, caer a PERT.
    const horasEnvio =
      r.horas_envio != null && Number.isFinite(Number(r.horas_envio))
        ? Number(r.horas_envio)
        : Math.round(((r.horas_min + r.horas_max) / 2) * 10) / 10;

    const tareasOrdenadas = (r.tareas_estimacion ?? []).sort(
      (a: any, b: any) => a.orden - b.orden
    );
    const puntos = tareasOrdenadas
      .slice(0, 4)
      .map((t: any) => t.nombre_limpio || "")
      .filter(Boolean);
    const descripcionCorta =
      (r.contexto_sherlyn ?? "").split(/[.\n]/)[0]?.trim() || r.nombre;

    const clickupUrl = r.clickup_ticket_id
      ? `https://app.clickup.com/t/${r.clickup_ticket_id}`
      : null;

    const slackTextNuevo = esFijo
      ? buildSlackTextFijo({
          nombreCotizacion: r.nombre,
          programador: r.programadores?.nombre ?? "—",
          montoFijoMxn: Number(r.monto_fijo ?? 0),
          descripcionCorta: r.contexto_sherlyn ?? r.nombre,
          notas: null,
          clickupUrl,
        })
      : buildSlackText({
          nombreCotizacion: r.nombre,
          proyecto: null,
          programador: r.programadores?.nombre ?? "—",
          horasEnvio,
          bufferPct: 0, // ya viene aplicado en horas_min/max
          descripcionCorta,
          puntosClave: puntos,
          notas: null,
          clickupUrl,
        });

    // Solo actualizamos slack_text — NO sobrescribimos horas_envio en /editar
    // para respetar la selección de Johana (Mín/PERT/Máx/Personalizado).
    // El endpoint dedicado /horas-envio se encarga de cambiar ese valor.
    const { error: refreshErr } = await supa
      .from("cotizaciones")
      .update({ slack_text: slackTextNuevo })
      .eq("id", params.id);
    if (refreshErr) {
      console.warn(
        "[editar] no se pudo refrescar slack_text:",
        refreshErr.message
      );
    }

    // ── Sincronizar ClickUp (usa helper centralizado) ────────────────
    if (r.clickup_ticket_id && process.env.CLICKUP_API_KEY) {
      try {
        // Obtener correo y recomendacion (no vienen en r)
        const fullResp = await supa
          .from("cotizaciones")
          .select("borrador_correo, ia_recomendacion, proyecto_clickup_id")
          .eq("id", params.id)
          .maybeSingle();
        const full = fullResp.data as
          | {
              borrador_correo: string | null;
              ia_recomendacion: string | null;
              proyecto_clickup_id: string | null;
            }
          | null;

        const syncResult = await syncCotizacionConClickUp({
          clickupTicketId: r.clickup_ticket_id,
          nombre: r.nombre,
          programadorNombre: r.programadores?.nombre ?? "—",
          horasEnvio,
          bufferPct: 0,
          contextoSherlyn: r.contexto_sherlyn ?? "",
          borradorCorreo: full?.borrador_correo ?? "",
          iaRecomendacion: full?.ia_recomendacion,
          descripcionCorta,
          puntosClave: puntos,
          proyectoClickupId: full?.proyecto_clickup_id ?? null,
          tareas: tareasOrdenadas.map((t: any) => ({
            nombre: t.nombre_limpio ?? "",
            descripcion: t.descripcion_limpia ?? "",
            hrs_min: t.hrs_min ?? 0,
            hrs_max: t.hrs_max ?? 0,
          })),
        });

        if (!syncResult.ok && syncResult.warnings.length > 0) {
          clickup_warning = syncResult.warnings.join(" · ");
        }
      } catch (e: any) {
        clickup_warning = e?.message || "No se pudo actualizar el ticket ClickUp";
      }
    }
  }

  // Log de la acción
  if (Object.keys(cambios).length > 0) {
    await supa.from("acciones_cotizacion").insert({
      cotizacion_id: params.id,
      tipo_accion: "editada",
      metadata: {
        cambios,
        comentario: body.comentario || null,
        clickup_warning,
      },
    });
  }

  revalidatePath(`/panel/cotizaciones/${params.id}`);
  revalidatePath("/panel/cotizaciones");

  return NextResponse.json({ ok: true, cambios, clickup_warning });
}
