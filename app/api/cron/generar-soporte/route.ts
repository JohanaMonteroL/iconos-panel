// GET /api/cron/generar-soporte
//
// Disparado por Vercel Cron (vercel.json, día 1 de cada mes). Vercel manda
// el header `Authorization: Bearer ${CRON_SECRET}` automáticamente cuando
// esa variable de entorno está configurada — este endpoint solo valida
// ese secreto (no usa la sesión de Johana, nadie hace login para esto).
//
// Genera el período de Soporte del mes en curso (zona horaria Tijuana,
// igual que el resto de la app) para cada proyecto con soporte_activo.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { generarPeriodosSoporteDelMes } from "@/lib/cobros/generarSoporte";

export const runtime = "nodejs";
export const maxDuration = 60;

function mesAnioActualTijuana(): { mes: number; anio: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Tijuana",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const anio = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return { mes, anio };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server sin Supabase" }, { status: 503 });
  }

  const supa = createSupabaseServiceClient();
  const { mes, anio } = mesAnioActualTijuana();
  const resultado = await generarPeriodosSoporteDelMes(supa, { mes, anio });

  if (resultado.errores.length > 0) {
    console.error("[cron/generar-soporte] errores:", resultado.errores);
  }

  return NextResponse.json({ ok: true, mes, anio, ...resultado });
}
