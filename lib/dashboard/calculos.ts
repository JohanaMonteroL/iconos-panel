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
