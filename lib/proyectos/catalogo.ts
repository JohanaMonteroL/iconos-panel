// Lectura simple del catálogo de Proyectos (tabla `proyectos`) para poblar
// selects de "Proyecto" — reemplaza a los viejos helpers de ClickUp
// (lib/clickup/client.ts: getProyectoOptions / getProyectosDesdeCarpetasDesarrollo).

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProyectoOpcion = { id: string; nombre: string; emoji?: string };

export async function getProyectosActivos(
  supa: SupabaseClient
): Promise<ProyectoOpcion[]> {
  try {
    let { data, error }: { data: any; error: any } = await supa
      .from("proyectos")
      .select("id, nombre, emoji")
      .eq("activo", true)
      .order("nombre");
    // Degradación si la migración de `emoji` todavía no se corrió.
    if (error && /emoji/i.test(error.message)) {
      ({ data, error } = await supa
        .from("proyectos")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"));
    }
    if (error) return [];
    return (data ?? []) as ProyectoOpcion[];
  } catch {
    return [];
  }
}
