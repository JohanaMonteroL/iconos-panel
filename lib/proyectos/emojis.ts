// Paleta de emojis para identificar un proyecto de un vistazo. Un proyecto
// elige uno (opcional) al crearse/editarse, y aparece junto a su nombre en
// todo el sistema donde se muestre (listado, ficha, buscador, tarjetas de
// Cotizaciones).

export const EMOJIS_PROYECTO = [
  "📁", "🚀", "💻", "📱", "🛒", "💰", "📊", "🎯",
  "🏗️", "🔧", "🛠️", "📦", "🌐", "🔒", "⚡", "🎨",
  "🍔", "🥗", "🚗", "✈️", "🏠", "🏥", "🏦", "🎮",
  "📚", "🎓", "🖥️", "📈", "🐾", "👕", "🧾", "📷",
] as const;

export const EMOJI_PROYECTO_DEFAULT = "";

export function esEmojiProyectoValido(valor: string): boolean {
  return valor === "" || EMOJIS_PROYECTO.includes(valor as (typeof EMOJIS_PROYECTO)[number]);
}
