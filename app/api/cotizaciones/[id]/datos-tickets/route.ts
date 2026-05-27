// GET /api/cotizaciones/[id]/datos-tickets
//
// Devuelve los datos necesarios para pre-llenar el wizard de creación de
// tickets a partir de una cotización aprobada/enviada al cliente.
//
// Devuelve dos vistas:
//   completo: { titulo, descripcion_md, horas_estimadas, asignado_correo }
//   por_tarea: [{ id, titulo, descripcion_md, horas_estimadas }, ...]
//
// La distribución de horas por tarea respeta el total enviado, igual que
// hacemos en el ticket de ClickUp.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Tarea = {
  id: string;
  orden: number;
  nombre_limpio: string | null;
  nombre_original: string;
  descripcion_limpia: string | null;
  descripcion_original: string | null;
  hrs_min: number;
  hrs_max: number;
};

function distribuirHoras(tareas: Tarea[], total: number): number[] {
  if (tareas.length === 0) return [];
  const medios = tareas.map((t) => (t.hrs_min + t.hrs_max) / 2);
  const suma = medios.reduce((a, b) => a + b, 0);
  if (suma <= 0) {
    const cada = Math.round((total / tareas.length) * 10) / 10;
    return tareas.map((_, i) =>
      i === tareas.length - 1
        ? Math.round((total - cada * (tareas.length - 1)) * 10) / 10
        : cada
    );
  }
  const escaladas = medios.map(
    (m) => Math.round((m * total) / suma * 10) / 10
  );
  const diff =
    Math.round((total - escaladas.reduce((a, b) => a + b, 0)) * 10) / 10;
  if (diff !== 0) {
    escaladas[escaladas.length - 1] = Math.max(
      0,
      Math.round((escaladas[escaladas.length - 1] + diff) * 10) / 10
    );
  }
  return escaladas;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!getSessionFromCookies().ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const supa = createSupabaseServiceClient();

  // 1) Cotización + horas + programador
  const { data: cot, error: cotErr } = await supa
    .from("cotizaciones")
    .select(
      `id, nombre, descripcion_limpia, contexto_sherlyn, borrador_correo,
       horas_min, horas_max, horas_envio, estado, programadores(nombre)`
    )
    .eq("id", params.id)
    .maybeSingle();
  if (cotErr || !cot) {
    return NextResponse.json(
      { error: "Cotización no encontrada" },
      { status: 404 }
    );
  }

  // 2) Tareas
  const { data: tareasRaw } = await supa
    .from("tareas_estimacion")
    .select(
      "id, orden, nombre_limpio, nombre_original, descripcion_limpia, descripcion_original, hrs_min, hrs_max"
    )
    .eq("cotizacion_id", params.id)
    .order("orden", { ascending: true });

  const tareas = (tareasRaw ?? []) as Tarea[];

  // Total que se usó al enviar al jefe (con buffer). Si no existe horas_envio,
  // usar punto medio de horas_min y horas_max.
  const total =
    (cot as any).horas_envio != null
      ? Number((cot as any).horas_envio)
      : Math.round(((cot.horas_min + cot.horas_max) / 2) * 10) / 10;

  const horasPorTarea = distribuirHoras(tareas, total);
  // Programadores no tiene columna correo en la tabla actual, así que solo
  // pre-llenamos el nombre. La admin elige el asignado de JIRA en el wizard.
  const programador = (cot as any).programadores as
    | { nombre: string }
    | null;

  // ── Vista "1 ticket completo" ──────────────────────────────────────
  const descripcionCompleta = [
    `### 👤 Solicitado por`,
    `Cotización aprobada — programador propuesto: ${programador?.nombre ?? "—"}.`,
    "",
    `### 🎯 Qué hay que hacer`,
    cot.descripcion_limpia?.trim() ||
      cot.contexto_sherlyn?.trim() ||
      cot.nombre,
    "",
    `### 📋 Tareas (${tareas.length})`,
    ...tareas.map((t, i) => {
      const nombre = t.nombre_limpio || t.nombre_original;
      const desc = t.descripcion_limpia || t.descripcion_original || "";
      const horas = horasPorTarea[i] ?? 0;
      return `- **${nombre}** _(${horas}h)_${desc ? ` — ${desc}` : ""}`;
    }),
    "",
    `### ⏱️ Total estimado`,
    `${total}h (rango aprobado: ${cot.horas_min}–${cot.horas_max}h).`,
  ].join("\n");

  const completo = {
    titulo: cot.nombre,
    descripcion_md: descripcionCompleta,
    horas_estimadas: total,
    asignado_nombre: programador?.nombre ?? null,
  };

  // ── Vista "1 ticket por tarea" ─────────────────────────────────────
  const porTarea = tareas.map((t, i) => {
    const nombre = t.nombre_limpio || t.nombre_original;
    const desc = t.descripcion_limpia || t.descripcion_original || "";
    return {
      tarea_id: t.id,
      titulo: nombre,
      descripcion_md: [
        `### 🎯 Qué hay que hacer`,
        desc || "_(falta detalle — completar)_",
        "",
        `### 📍 Contexto`,
        `Forma parte de la cotización aprobada **${cot.nombre}**.`,
      ].join("\n"),
      horas_estimadas: horasPorTarea[i] ?? 0,
    };
  });

  return NextResponse.json({
    cotizacion: {
      id: cot.id,
      nombre: cot.nombre,
      estado: cot.estado,
      total_horas: total,
      programador_nombre: programador?.nombre ?? null,
    },
    completo,
    por_tarea: porTarea,
  });
}
