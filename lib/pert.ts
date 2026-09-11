// PERT (Program Evaluation and Review Technique):
//   esperado = (optimista + 4 * más_probable + pesimista) / 6
// Si no se conoce "más probable", usamos el punto medio (min+max)/2 como aproximación.
// Esto reduce la fórmula a (min + max) / 2 en el caso de 2 puntos.

export function pertEsperado(min: number, max: number, masProbable?: number | null): number {
  const M =
    masProbable !== null && masProbable !== undefined && Number.isFinite(masProbable)
      ? masProbable
      : (min + max) / 2;
  return (min + 4 * M + max) / 6;
}

export type TareaHoras = {
  hrs_min: number;
  hrs_max: number;
  hrs_mas_probable?: number | null;
};

export function totalesPERT(tareas: TareaHoras[]) {
  let totalMin = 0;
  let totalMax = 0;
  let totalEsperado = 0;
  for (const t of tareas) {
    totalMin += t.hrs_min || 0;
    totalMax += t.hrs_max || 0;
    totalEsperado += pertEsperado(t.hrs_min || 0, t.hrs_max || 0, t.hrs_mas_probable ?? null);
  }
  return {
    totalMin,
    totalMax,
    totalEsperado: Math.round(totalEsperado * 10) / 10,
  };
}

/**
 * Aplica un porcentaje de buffer a las horas y devuelve los totales redondeados
 * a 1 decimal. Buffer 0 devuelve los mismos valores.
 */
export function aplicarBuffer(
  totales: { totalMin: number; totalMax: number; totalEsperado: number },
  bufferPct: number
) {
  const factor = 1 + (Number.isFinite(bufferPct) ? bufferPct : 0) / 100;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    totalMin: round1(totales.totalMin * factor),
    totalMax: round1(totales.totalMax * factor),
    totalEsperado: round1(totales.totalEsperado * factor),
  };
}

/**
 * Reparte un total de horas entre tareas, proporcional al punto medio
 * (hrs_min+hrs_max)/2 de cada una — la última tarea absorbe el redondeo
 * para que la suma cuadre exacto con `total`. Si todas las tareas están en
 * cero, reparte en partes iguales.
 *
 * Antes vivía duplicada en app/api/cotizaciones/[id]/datos-tickets/route.ts
 * (pre-llenar el wizard de tickets) — un solo lugar para esa lógica.
 */
export function distribuirHorasProporcional(
  tareas: { hrs_min: number; hrs_max: number }[],
  total: number
): number[] {
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
    (m) => Math.round(((m * total) / suma) * 10) / 10
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
