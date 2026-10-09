// Orden manual de tarjetas dentro de un carril (columna = estado) de los
// tableros kanban. Ver supabase/migrations/0028_orden_tableros.sql.
//
// El cliente manda las vecinas que quedan arriba (`antesId`) y abajo
// (`despuesId`) de la tarjeta ya en su carril final, y aquí se calcula el
// nuevo `orden_tablero`. Normalmente es el punto medio de las vecinas (1 UPDATE);
// si no hay hueco (empates heredados del backfill o tras muchas
// bisecciones en el mismo sitio) se renumera el carril completo.
//
// Columna `orden_tablero` (no `orden`: en cobros_periodos `orden` es la
// secuencia del período dentro de su cobro).

import { createSupabaseServiceClient } from "@/lib/supabase/server";

type Supa = ReturnType<typeof createSupabaseServiceClient>;
export type TablaTablero = "cotizaciones" | "cobros_periodos";

type Fila = { id: string; estado: string; orden_tablero: number };

export class ErrorOrden extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function leerVecinas(body: any): { antesId: string | null; despuesId: string | null } {
  const limpiar = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { antesId: limpiar(body?.antes_id), despuesId: limpiar(body?.despues_id) };
}

export async function reordenarEnCarril(
  supa: Supa,
  tabla: TablaTablero,
  id: string,
  antesId: string | null,
  despuesId: string | null
): Promise<void> {
  if (id === antesId || id === despuesId) throw new ErrorOrden("Vecinas inválidas", 422);

  const ids = [id, antesId, despuesId].filter((x): x is string => !!x);
  const { data, error } = await supa.from(tabla).select("id, estado, orden_tablero").in("id", ids);
  if (error) throw new ErrorOrden(error.message, 500);

  const filas = new Map(((data ?? []) as Fila[]).map((f) => [f.id, f]));
  const actual = filas.get(id);
  if (!actual) throw new ErrorOrden("Tarjeta no encontrada", 404);
  const antes = antesId ? filas.get(antesId) : null;
  const despues = despuesId ? filas.get(despuesId) : null;
  // Una vecina que ya no existe o cambió de carril significa que el tablero
  // del cliente está desactualizado: mejor rechazar que guardar un orden
  // que no es el que la usuaria vio.
  if ((antesId && antes?.estado !== actual.estado) || (despuesId && despues?.estado !== actual.estado)) {
    throw new ErrorOrden("El tablero cambió mientras movías la tarjeta. Recarga e intenta de nuevo.", 409);
  }

  let nuevo: number | null = null;
  if (antes && despues) {
    const medio = (antes.orden_tablero + despues.orden_tablero) / 2;
    if (antes.orden_tablero < medio && medio < despues.orden_tablero) nuevo = medio;
  } else if (antes) {
    nuevo = antes.orden_tablero + 1;
  } else if (despues) {
    nuevo = despues.orden_tablero - 1;
  } else {
    return; // carril vacío: cualquier orden sirve
  }

  if (nuevo !== null) {
    const { error: updErr } = await supa.from(tabla).update({ orden_tablero: nuevo }).eq("id", id);
    if (updErr) throw new ErrorOrden(updErr.message, 500);
    return;
  }

  await renumerarCarril(supa, tabla, actual.estado, id, antesId!);
}

// Reescribe `orden_tablero` de todo el carril con pasos de 1, dejando `id` justo
// debajo de `antesId`. Solo actualiza las filas cuyo valor cambia.
async function renumerarCarril(supa: Supa, tabla: TablaTablero, estado: string, id: string, antesId: string) {
  const { data, error } = await supa
    .from(tabla)
    .select("id, orden_tablero")
    .eq("estado", estado)
    .order("orden_tablero", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw new ErrorOrden(error.message, 500);

  const filas = ((data ?? []) as { id: string; orden_tablero: number }[])
    .map((f) => ({ id: f.id, orden: f.orden_tablero }))
    .filter((f) => f.id !== id);
  const pos = filas.findIndex((f) => f.id === antesId);
  filas.splice(pos + 1, 0, { id, orden: NaN });

  const base = Math.floor(filas.reduce((min, f) => (Number.isNaN(f.orden) ? min : Math.min(min, f.orden)), Infinity));
  const cambios = filas
    .map((f, i) => ({ id: f.id, orden: base + i, previo: f.orden }))
    .filter((f) => f.orden !== f.previo);

  const resultados = await Promise.all(
    cambios.map((c) => supa.from(tabla).update({ orden_tablero: c.orden }).eq("id", c.id))
  );
  const fallo = resultados.find((r) => r.error);
  if (fallo?.error) throw new ErrorOrden(fallo.error.message, 500);
}
