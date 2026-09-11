// Formato de fechas — fuerza zona horaria de Mexicali (Tijuana)
// independientemente de la zona del navegador, para evitar desfases.

const ZONA = "America/Tijuana";

export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: ZONA,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function formatFechaLarga(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: ZONA,
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

export function formatHora(d: Date): string {
  return d.toLocaleTimeString("es-MX", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export type RangoFechaRapido = "este_mes" | "mes_pasado";

// Rango de fechas (YYYY-MM-DD) para los filtros rápidos "Este mes" / "Mes
// pasado" — el mes en curso se calcula en la zona horaria de Mexicali, no
// la del servidor.
export function rangoRapidoAFechas(rango: RangoFechaRapido): { desde: string; hasta: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const anioActual = Number(partes.find((p) => p.type === "year")?.value);
  const mesActual = Number(partes.find((p) => p.type === "month")?.value); // 1-12

  const anio = rango === "mes_pasado" ? (mesActual === 1 ? anioActual - 1 : anioActual) : anioActual;
  const mes = rango === "mes_pasado" ? (mesActual === 1 ? 12 : mesActual - 1) : mesActual;

  const ultimoDia = new Date(anio, mes, 0).getDate();
  return {
    desde: `${anio}-${String(mes).padStart(2, "0")}-01`,
    hasta: `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`,
  };
}
