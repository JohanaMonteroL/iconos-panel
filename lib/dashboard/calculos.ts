// Cálculos puros para el dashboard de Inicio — bucketing por mes (zona
// horaria de Tijuana, mismo criterio que lib/dates.ts) y formato compartido.
// Recibe siempre datos ya cargados de la base; no toca Supabase aquí.

const ZONA = "America/Tijuana";
const NOMBRES_MES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export type MesBucket = { anio: number; mes: number; key: string; label: string };

/** Últimos `n` meses (incluye el actual), del más antiguo al más reciente. */
export function ultimosMeses(n: number, ahora: Date = new Date()): MesBucket[] {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(ahora);
  const anioActual = Number(partes.find((p) => p.type === "year")?.value);
  const mesActual = Number(partes.find((p) => p.type === "month")?.value);

  const out: MesBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let mes = mesActual - i;
    let anio = anioActual;
    while (mes <= 0) {
      mes += 12;
      anio -= 1;
    }
    out.push({
      anio,
      mes,
      key: `${anio}-${String(mes).padStart(2, "0")}`,
      label: `${NOMBRES_MES_CORTO[mes - 1]} ${anio}`,
    });
  }
  return out;
}

/** "YYYY-MM" de una fecha ISO, en la zona horaria del negocio. */
export function claveMes(fechaISO: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(fechaISO));
  const anio = partes.find((p) => p.type === "year")?.value;
  const mes = partes.find((p) => p.type === "month")?.value;
  return `${anio}-${mes}`;
}

export function fmtMxnCompacto(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** % de cambio de `actual` vs `anterior` — null si no hay base de comparación. */
export function variacionPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? null : null;
  return ((actual - anterior) / anterior) * 100;
}

export type CambioEstadoCotizacion = {
  cotizacion_id: string;
  estado: string;
  estado_anterior: string | null;
  created_at: string;
};

/**
 * Cuántas cotizaciones estaban en `estado` (p. ej. "en_desarrollo") al
 * cierre de cada mes. Es un conteo de "existencias", no de las creadas en el
 * mes: una cotización creada en agosto que sigue en desarrollo en octubre
 * cuenta en agosto, septiembre y octubre.
 *
 * - Mes actual: el estado de hoy (`cotizaciones[].estado`).
 * - Meses pasados: se reconstruye con el log de cambios de estado
 *   (acciones_cotizacion "estado_*", que registran todas las rutas que
 *   cambian el estado). Antes del primer cambio registrado se usa su
 *   `estado_anterior`; sin ningún cambio, el estado actual.
 *
 * `cotizaciones` puede no traer las archivadas: las que solo aparecen en el
 * log se cuentan desde la fecha de su primer cambio.
 */
export function cotizacionesEnEstadoPorMes(
  meses: MesBucket[],
  cotizaciones: { id: string; estado: string; created_at: string }[],
  cambios: CambioEstadoCotizacion[],
  estado: string
): Map<string, number> {
  const resultado = new Map(meses.map((m) => [m.key, 0]));
  if (meses.length === 0) return resultado;
  const mesActual = meses[meses.length - 1].key;

  const cambiosPorId = new Map<string, (CambioEstadoCotizacion & { key: string })[]>();
  for (const c of cambios) {
    const arr = cambiosPorId.get(c.cotizacion_id) ?? [];
    arr.push({ ...c, key: claveMes(c.created_at) });
    cambiosPorId.set(c.cotizacion_id, arr);
  }
  cambiosPorId.forEach((arr) => arr.sort((a, b) => a.created_at.localeCompare(b.created_at)));

  const cotPorId = new Map(cotizaciones.map((c) => [c.id, c]));
  const ids = new Set<string>([...Array.from(cotPorId.keys()), ...Array.from(cambiosPorId.keys())]);

  ids.forEach((id) => {
    const cot = cotPorId.get(id);
    const log = cambiosPorId.get(id) ?? [];
    const creadaKey = cot ? claveMes(cot.created_at) : log[0].key;

    for (const m of meses) {
      if (m.key < creadaKey) continue;
      let estadoAlCierre: string | null | undefined;
      if (m.key === mesActual && cot) {
        estadoAlCierre = cot.estado;
      } else {
        const ultimo = log.filter((c) => c.key <= m.key).pop();
        estadoAlCierre = ultimo ? ultimo.estado : log.length > 0 ? log[0].estado_anterior : cot?.estado;
      }
      if (estadoAlCierre === estado) resultado.set(m.key, (resultado.get(m.key) ?? 0) + 1);
    }
  });

  return resultado;
}
