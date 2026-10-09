import type { createSupabaseServiceClient } from "@/lib/supabase/server";

// Proyecto (cliente) del catálogo para enlazar a su ficha, o null si no
// existe. `proyecto_clickup_id` normalmente es proyectos.id, pero en
// cotizaciones viejas puede ser un id de ClickUp (ver migración 0025) o
// venir vacío con solo el nombre: se valida por id y si no, por nombre.
// Incluye proyectos inactivos (su ficha sigue existiendo).
export async function resolverProyectoId(
  supa: ReturnType<typeof createSupabaseServiceClient>,
  id: string | null,
  nombre: string | null
): Promise<string | null> {
  if (!id && !nombre) return null;
  try {
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      const { data } = await supa.from("proyectos").select("id").eq("id", id).maybeSingle();
      if (data?.id) return data.id as string;
    }
    if (nombre?.trim()) {
      // Coincidencia exacta sin importar mayúsculas (se escapan % y _).
      const patron = nombre.trim().replace(/[%_\\]/g, "\\$&");
      const { data } = await supa.from("proyectos").select("id").ilike("nombre", patron).limit(1);
      if (data?.[0]?.id) return data[0].id as string;
    }
  } catch {
    // Sin enlace si falla la consulta; el nombre se sigue mostrando.
  }
  return null;
}

