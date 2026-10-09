// Notificaciones breves ("Guardado", "Movido a Facturado"…) que se muestran
// abajo a la derecha. Cualquier componente cliente llama a `toast(...)`;
// <Toaster /> (montado una vez en app/panel/layout.tsx) las dibuja.

export type TipoToast = "exito" | "error" | "info";
export type Toast = { id: number; mensaje: string; tipo: TipoToast; duracion: number };

type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();
let siguienteId = 1;

export function toast(mensaje: string, opciones: { tipo?: TipoToast; duracion?: number } = {}) {
  const t: Toast = {
    id: siguienteId++,
    mensaje,
    tipo: opciones.tipo ?? "exito",
    duracion: opciones.duracion ?? (opciones.tipo === "error" ? 6000 : 3200),
  };
  listeners.forEach((l) => l(t));
}

export function suscribirToasts(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
