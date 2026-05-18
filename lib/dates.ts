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
