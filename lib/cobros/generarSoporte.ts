// Generación mensual de los períodos de Soporte — la lógica real vive acá
// (el cron en app/api/cron/generar-soporte/route.ts es un wrapper delgado
// que solo valida el CRON_SECRET y llama a esta función). Separada así
// para poder dispararla a mano desde un script de prueba sin pasar por
// HTTP, como pide la sección de Verificación del plan.
//
// Por cada proyecto con soporte_activo=true:
//  - busca/crea su único `cobros` (origen soporte, uno solo por proyecto).
//  - salta si ya existe un período para ese mes/año (protegido también por
//    el índice único uq_cobros_periodos_mes).
//  - crea el período:
//      fijo:     monto = soporte_horas_fijas × tarifa.
//      variable: monto = 0, horas_trabajadas = 0 — Johana llena las horas
//                reales después; si el mes no tuvo horas, ella borra el
//                período a mano (y si era el único, se borra el cobro
//                completo también — ver DELETE /api/cobros/periodos/[id]).

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { tarifaSoporte } from "./calculos";

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export type ResultadoGeneracionSoporte = {
  migracionPendiente: boolean;
  proyectosProcesados: number;
  periodosCreados: number;
  periodosOmitidos: number;
  errores: { proyectoId: string; proyectoNombre?: string; mensaje: string }[];
};

const MESES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function relationOrColumnMissing(message: string | undefined | null): boolean {
  if (!message) return false;
  return /relation .* does not exist|column .* does not exist/i.test(message);
}

type ProyectoSoporte = {
  id: string;
  nombre: string;
  moneda_hora: string | null;
  soporte_tipo: string | null;
  soporte_horas_fijas: number | null;
  soporte_tarifa_hora: number | null;
  precio_hora_venta: number | null;
};

export async function generarPeriodosSoporteDelMes(
  supa: SupabaseServiceClient,
  { mes, anio }: { mes: number; anio: number }
): Promise<ResultadoGeneracionSoporte> {
  const resultado: ResultadoGeneracionSoporte = {
    migracionPendiente: false,
    proyectosProcesados: 0,
    periodosCreados: 0,
    periodosOmitidos: 0,
    errores: [],
  };

  const { data, error } = await supa
    .from("proyectos")
    .select(
      "id, nombre, moneda_hora, soporte_tipo, soporte_horas_fijas, soporte_tarifa_hora, precio_hora_venta"
    )
    .eq("soporte_activo", true);

  if (error) {
    if (relationOrColumnMissing(error.message)) {
      // Migración 0023 (columnas de soporte en proyectos) todavía no
      // corrida — no hay nada que generar, no es un error real.
      resultado.migracionPendiente = true;
      return resultado;
    }
    resultado.errores.push({ proyectoId: "-", mensaje: error.message });
    return resultado;
  }

  const proyectos = (data ?? []) as ProyectoSoporte[];
  const etiqueta = `${MESES_LABEL[mes - 1] ?? mes} ${anio}`;

  for (const proyecto of proyectos) {
    resultado.proyectosProcesados++;
    try {
      let cobroId: string | undefined;
      const { data: cobroExistente, error: cobroErr } = await supa
        .from("cobros")
        .select("id")
        .eq("proyecto_id", proyecto.id)
        .eq("origen", "soporte")
        .maybeSingle();
      if (cobroErr) {
        if (relationOrColumnMissing(cobroErr.message)) {
          resultado.migracionPendiente = true;
          return resultado;
        }
        throw new Error(cobroErr.message);
      }
      cobroId = cobroExistente?.id;

      if (!cobroId) {
        const { data: nuevoCobro, error: insCobroErr } = await supa
          .from("cobros")
          .insert({
            origen: "soporte",
            proyecto_id: proyecto.id,
            titulo: `Soporte — ${proyecto.nombre}`,
            monto_total: null,
            moneda: proyecto.moneda_hora || "MXN",
          })
          .select("id")
          .maybeSingle();
        if (insCobroErr) throw new Error(insCobroErr.message);
        cobroId = nuevoCobro?.id;
      }
      if (!cobroId) throw new Error("No se pudo crear/obtener el cobro de soporte");

      const { data: periodoExistente, error: existErr } = await supa
        .from("cobros_periodos")
        .select("id")
        .eq("cobro_id", cobroId)
        .eq("mes", mes)
        .eq("anio", anio)
        .maybeSingle();
      if (existErr) throw new Error(existErr.message);
      if (periodoExistente) {
        resultado.periodosOmitidos++;
        continue;
      }

      const tarifa = tarifaSoporte(proyecto);
      const esVariable = proyecto.soporte_tipo === "variable";
      const horas = esVariable ? 0 : Number(proyecto.soporte_horas_fijas || 0);
      const monto = esVariable ? 0 : horas * tarifa;

      const { error: perErr } = await supa.from("cobros_periodos").insert({
        cobro_id: cobroId,
        estado: "listo_para_cobrar",
        etiqueta,
        monto,
        moneda: proyecto.moneda_hora || "MXN",
        mes,
        anio,
        horas_trabajadas: horas,
        tarifa_hora_snapshot: tarifa,
      });
      if (perErr) throw new Error(perErr.message);

      resultado.periodosCreados++;
    } catch (e: any) {
      resultado.errores.push({
        proyectoId: proyecto.id,
        proyectoNombre: proyecto.nombre,
        mensaje: e?.message || "Error desconocido",
      });
    }
  }

  return resultado;
}
