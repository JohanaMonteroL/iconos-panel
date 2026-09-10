// Paleta de colores para la etiqueta de Proyecto. Un proyecto elige uno al
// crearse/editarse, y ese color se usa en todo el sistema donde aparezca
// (listado de proyectos, tarjetas de Cotizaciones nueva vista, etc.).

export const COLORES_PROYECTO = [
  { nombre: "Rojo", valor: "#EF4444" },
  { nombre: "Naranja", valor: "#F97316" },
  { nombre: "Ámbar", valor: "#F59E0B" },
  { nombre: "Amarillo", valor: "#EAB308" },
  { nombre: "Lima", valor: "#84CC16" },
  { nombre: "Verde", valor: "#22C55E" },
  { nombre: "Esmeralda", valor: "#10B981" },
  { nombre: "Verde azulado", valor: "#14B8A6" },
  { nombre: "Cian", valor: "#06B6D4" },
  { nombre: "Celeste", valor: "#0EA5E9" },
  { nombre: "Azul", valor: "#3B82F6" },
  { nombre: "Índigo", valor: "#6366F1" },
  { nombre: "Violeta", valor: "#8B5CF6" },
  { nombre: "Púrpura", valor: "#A855F7" },
  { nombre: "Fucsia", valor: "#D946EF" },
  { nombre: "Rosa", valor: "#EC4899" },
  { nombre: "Rosa fuerte", valor: "#F43F5E" },
  { nombre: "Café", valor: "#92400E" },
  { nombre: "Gris piedra", valor: "#78716C" },
  { nombre: "Gris", valor: "#6B7280" },
  { nombre: "Pizarra", valor: "#64748B" },
  { nombre: "Negro", valor: "#18181B" },
] as const;

export const COLOR_PROYECTO_DEFAULT = "#6B7280";

export function esColorProyectoValido(valor: string): boolean {
  return COLORES_PROYECTO.some((c) => c.valor.toLowerCase() === valor.toLowerCase());
}
