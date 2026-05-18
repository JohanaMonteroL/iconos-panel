// Reintenta crear el ticket de ClickUp para una cotización que no lo tiene.
// Usado cuando la creación inicial falló por configuración o red.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  clickUpConfigured,
  createTask,
  getProyectoFieldId,
  resolveCotizacionesListId,
  getFieldByNamePattern,
  findOptionIdsByName,
  getDefaultAssigneeId,
  findMatchingStatus,
  STATUS_CANDIDATES,
} from "@/lib/clickup/client";
import { buildClickUpDescription, stripEmojis } from "@/lib/clickup/format";
import type { EstimacionLimpia } from "@/lib/anthropic/process";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }
  if (!clickUpConfigured()) {
    return NextResponse.json(
      { error: "ClickUp no configurado en .env.local" },
      { status: 503 }
    );
  }

  const supa = createSupabaseServiceClient();

  // Intento traer también horas_envio; si la migración 0004 no se corrió, reintento sin.
  const baseSelect = `id, nombre, horas_min, horas_max, clickup_ticket_id, proyecto_clickup_id,
     ia_recomendacion, contexto_sherlyn, borrador_correo,
     programadores(nombre),
     tareas_estimacion(orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`;
  const withEnvio = `id, nombre, horas_min, horas_max, horas_envio, clickup_ticket_id, proyecto_clickup_id,
     ia_recomendacion, contexto_sherlyn, borrador_correo,
     programadores(nombre),
     tareas_estimacion(orden, nombre_limpio, descripcion_limpia, hrs_min, hrs_max)`;

  let cotResp = await supa
    .from("cotizaciones")
    .select(withEnvio)
    .eq("id", params.id)
    .maybeSingle();
  if (cotResp.error && /horas_envio/.test(cotResp.error.message)) {
    cotResp = await supa
      .from("cotizaciones")
      .select(baseSelect)
      .eq("id", params.id)
      .maybeSingle();
  }
  const cot = cotResp.data;
  const cotErr = cotResp.error;

  if (cotErr || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  if (cot.clickup_ticket_id) {
    return NextResponse.json(
      { error: "Esta cotización ya tiene un ticket de ClickUp" },
      { status: 409 }
    );
  }

  const listId = await resolveCotizacionesListId();
  if (!listId) {
    return NextResponse.json(
      { error: "No se encontró la lista del sprint actual" },
      { status: 500 }
    );
  }

  const tareas = ((cot as any).tareas_estimacion as any[]) ?? [];
  tareas.sort((a, b) => a.orden - b.orden);

  const limpia: EstimacionLimpia = {
    nombre_solicitud: cot.nombre,
    tareas: tareas.map((t) => ({
      nombre: t.nombre_limpio,
      descripcion: t.descripcion_limpia ?? "",
      hrs_min: t.hrs_min,
      hrs_max: t.hrs_max,
    })),
    recomendacion_horas: cot.ia_recomendacion ?? "",
    contexto_sherlyn: cot.contexto_sherlyn ?? "",
    borrador_correo: cot.borrador_correo ?? "",
    descripcion_corta: "",
    puntos_clave: [],
  };

  const programadorNombre = (cot as any).programadores?.nombre ?? "—";
  const horasEnvio =
    (cot as any).horas_envio != null
      ? Number((cot as any).horas_envio)
      : Math.round(((cot.horas_min + cot.horas_max) / 2) * 10) / 10;

  const description = buildClickUpDescription({
    limpia,
    programadorNombre,
    bufferPct: 0, // no lo conocemos en este punto; ya viene aplicado a horas_envio
    horasEnvio,
    notas: null,
  });

  const custom_fields: Array<{ id: string; value: any }> = [];
  if (cot.proyecto_clickup_id) {
    const fid = await getProyectoFieldId();
    if (fid) custom_fields.push({ id: fid, value: cot.proyecto_clickup_id });
  }
  const horasField = await getFieldByNamePattern(/horas enviad/i);
  if (horasField) {
    custom_fields.push({ id: horasField.id, value: String(horasEnvio) });
  }
  if (programadorNombre && programadorNombre !== "—") {
    const prog = await findOptionIdsByName(/programador/i, programadorNombre);
    if (prog) custom_fields.push({ id: prog.fieldId, value: prog.optionIds });
  }
  const johanaId = await getDefaultAssigneeId();

  const { status: estadoEstimado } = await findMatchingStatus(
    listId,
    STATUS_CANDIDATES.estimado
  );

  try {
    const task = await createTask({
      list_id: listId,
      name: stripEmojis(cot.nombre),
      description,
      status: estadoEstimado ?? undefined,
      assignees: johanaId ? [johanaId] : undefined,
      custom_fields: custom_fields.length ? custom_fields : undefined,
    });

    await supa
      .from("cotizaciones")
      .update({ clickup_ticket_id: task.id })
      .eq("id", params.id);

    await supa.from("acciones_cotizacion").insert({
      cotizacion_id: params.id,
      tipo_accion: "ticket_clickup_creado_retry",
      metadata: { task_id: task.id, url: task.url },
    });

    revalidatePath(`/panel/cotizaciones/${params.id}`);

    return NextResponse.json({ ok: true, clickup_ticket_id: task.id, url: task.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "No se pudo crear el ticket" },
      { status: 500 }
    );
  }
}
