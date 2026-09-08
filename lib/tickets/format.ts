// Helpers de formato para tickets de desarrollo (ahora en ClickUp).
// Antes vivían en lib/jira/format.ts — la parte de prefijos/tipo no era
// específica de JIRA, así que se movió aquí tal cual.

export type TipoTicket = "estimacion" | "desarrollo" | "soporte" | "investigacion";
export type SubTipoTicket = "task" | "historia" | "bug";

export function prefijoTitulo(tipo: TipoTicket): string {
  switch (tipo) {
    case "estimacion":
      return "Estimación: ";
    case "soporte":
      return "Soporte: ";
    case "investigacion":
      return "Investigación: ";
    case "desarrollo":
    default:
      return "";
  }
}

export function aplicarPrefijo(tipo: TipoTicket, tituloCorto: string): string {
  const pref = prefijoTitulo(tipo);
  const limpio = tituloCorto.replace(
    /^\s*(Estimación|Soporte|Investigación)\s*:\s*/i,
    ""
  );
  return `${pref}${limpio.trim()}`;
}

// ── Prioridad: panel → ClickUp ──────────────────────────────────────────
// ClickUp solo soporta 4 niveles (1=urgent, 2=high, 3=normal, 4=low), el
// panel usa 5 (highest/high/medium/low/lowest) — colapsamos los extremos.
export function mapearPrioridadAClickUp(p: string): 1 | 2 | 3 | 4 {
  switch (p.toLowerCase()) {
    case "highest":
      return 1;
    case "high":
      return 2;
    case "medium":
      return 3;
    case "low":
    case "lowest":
      return 4;
    default:
      return 3;
  }
}
