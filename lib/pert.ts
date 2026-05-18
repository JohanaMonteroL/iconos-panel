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
