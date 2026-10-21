// CLABE / número de tarjeta o cuenta — se guarda como dígitos limpios (sin
// espacios, listo para copiar y pegar), pero se captura y se muestra
// agrupado de 4 en 4 para que sea fácil de leer y revisar, como un número de
// tarjeta. CLABE mexicana = 18 dígitos; tarjeta = 16; cuenta: variable.

export function soloDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function formatearClabe(v: string): string {
  const d = soloDigitos(v).slice(0, 20);
  return (d.match(/.{1,4}/g) ?? []).join(" ");
}

/** Pista legible según la cantidad de dígitos capturados — nunca bloquea, solo orienta. */
export function tipoClabe(v: string): string | null {
  const d = soloDigitos(v);
  if (!d) return null;
  if (d.length === 18) return "CLABE (18 dígitos) ✓";
  if (d.length === 16) return "Número de tarjeta (16 dígitos) ✓";
  return `${d.length} dígito${d.length === 1 ? "" : "s"} — CLABE son 18, tarjeta 16`;
}
