// Sincronización de un ticket de ClickUp con el estado vigente de una cotización.
//
// La API de ClickUp tiene un detalle importante: al CREAR un task se usa
// `markdown_description`, pero al ACTUALIZAR (PUT) se usa `markdown_content`.
// Los custom fields requieren un endpoint dedicado por campo.

import { getFieldByNamePattern, findOptionIdsByName } from "@/lib/clickup/client";
import { buildClickUpDescription, stripEmojis } from "@/lib/clickup/format";
import type { EstimacionLimpia } from "@/lib/anthropic/process";

const BASE = "https://api.clickup.com/api/v2";

export type CotizacionSyncInput = {
  clickupTicketId: string;
  nombre: string;
  programadorNombre: string;
  horasEnvio: number;
  bufferPct?: number;
  contextoSherlyn: string;
  borradorCorreo: string;
  iaRecomendacion?: string | null;
  descripcionCorta: string;
  puntosClave: string[];
  notas?: string | null;
  proyectoClickupId?: string | null;
  tareas: Array<{
    nombre: string;
    descripcion: string;
    hrs_min: number;
    hrs_max: number;
  }>;
};

export type SyncResult = {
  ok: boolean;
  taskUpdated: boolean;
  customFieldsUpdated: number;
  warnings: string[];
};

async function clickup<T>(
  path: string,
  init: RequestInit & { method: string },
  apiKey: string
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  let data: T | null = null;
  let text = "";
  try {
    text = await res.text();
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, data, text };
}

export async function syncCotizacionConClickUp(
  input: CotizacionSyncInput
): Promise<SyncResult> {
  const apiKey = process.env.CLICKUP_API_KEY;
  const warnings: string[] = [];

  if (!apiKey) {
    return {
      ok: false,
      taskUpdated: false,
      customFieldsUpdated: 0,
      warnings: ["CLICKUP_API_KEY no configurado"],
    };
  }

  // Construir descripción markdown
  const limpia: EstimacionLimpia = {
    nombre_solicitud: input.nombre,
    tareas: input.tareas,
    recomendacion_horas: input.iaRecomendacion ?? "",
    contexto_sherlyn: input.contextoSherlyn,
    borrador_correo: input.borradorCorreo,
    descripcion_corta: input.descripcionCorta,
    puntos_clave: input.puntosClave,
  };
  const nuevaDescripcion = buildClickUpDescription({
    limpia,
    programadorNombre: input.programadorNombre,
    bufferPct: input.bufferPct ?? 0,
    horasEnvio: input.horasEnvio,
    notas: input.notas ?? null,
  });

  // 1) Actualizar nombre + descripción
  const putRes = await clickup<any>(
    `/task/${input.clickupTicketId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        name: stripEmojis(input.nombre),
        description: nuevaDescripcion,
        // Para UPDATE, ClickUp usa "markdown_content" (no markdown_description)
        markdown_content: nuevaDescripcion,
      }),
    },
    apiKey
  );
  let taskUpdated = putRes.ok;
  if (!putRes.ok) {
    warnings.push(
      `PUT /task respondió ${putRes.status}: ${putRes.text.slice(0, 200)}`
    );
  }

  // 2) Custom fields — endpoint dedicado por cada uno
  let customFieldsUpdated = 0;

  // Horas enviadas (short_text)
  try {
    const horasField = await getFieldByNamePattern(/horas enviad/i);
    if (horasField) {
      const r = await clickup<any>(
        `/task/${input.clickupTicketId}/field/${horasField.id}`,
        {
          method: "POST",
          body: JSON.stringify({ value: String(input.horasEnvio) }),
        },
        apiKey
      );
      if (r.ok) customFieldsUpdated++;
      else
        warnings.push(
          `Horas enviadas respondió ${r.status}: ${r.text.slice(0, 150)}`
        );
    }
  } catch (e: any) {
    warnings.push(`Horas enviadas: ${e?.message ?? "error"}`);
  }

  // Proyecto (drop_down)
  if (input.proyectoClickupId) {
    try {
      const proyectoField = await getFieldByNamePattern(/proyecto/i);
      if (proyectoField) {
        const r = await clickup<any>(
          `/task/${input.clickupTicketId}/field/${proyectoField.id}`,
          {
            method: "POST",
            body: JSON.stringify({ value: input.proyectoClickupId }),
          },
          apiKey
        );
        if (r.ok) customFieldsUpdated++;
        else
          warnings.push(
            `Proyecto respondió ${r.status}: ${r.text.slice(0, 150)}`
          );
      }
    } catch (e: any) {
      warnings.push(`Proyecto: ${e?.message ?? "error"}`);
    }
  }

  // Programador (labels) — ClickUp espera array completo, no delta
  if (input.programadorNombre && input.programadorNombre !== "—") {
    try {
      const prog = await findOptionIdsByName(/programador/i, input.programadorNombre);
      if (prog) {
        const r = await clickup<any>(
          `/task/${input.clickupTicketId}/field/${prog.fieldId}`,
          {
            method: "POST",
            body: JSON.stringify({ value: prog.optionIds }),
          },
          apiKey
        );
        if (r.ok) customFieldsUpdated++;
        else
          warnings.push(
            `Programador respondió ${r.status}: ${r.text.slice(0, 150)}`
          );
      }
    } catch (e: any) {
      warnings.push(`Programador: ${e?.message ?? "error"}`);
    }
  }

  return {
    ok: taskUpdated && warnings.length === 0,
    taskUpdated,
    customFieldsUpdated,
    warnings,
  };
}
