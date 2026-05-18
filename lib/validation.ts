// Validación compartida cliente/servidor (sin dependencias externas para no inflar el bundle).

export type EstimacionPayload = {
  programador_id: string;
  nombre_solicitud: string;
  notas?: string;
  proyecto_clickup_id?: string;
  proyecto_nombre?: string;
  buffer_porcentaje: number;
  tareas: Array<{
    nombre: string;
    descripcion: string;
    hrs_min: number;
    hrs_max: number;
    hrs_mas_probable: number | null;
  }>;
};

export type ValidationError = { path: string; message: string };

export function validateEstimacion(input: unknown): {
  ok: boolean;
  errors: ValidationError[];
  data?: EstimacionPayload;
} {
  const errors: ValidationError[] = [];
  const obj = (input ?? {}) as Record<string, unknown>;

  const programador_id = String(obj.programador_id ?? "").trim();
  const nombre_solicitud = String(obj.nombre_solicitud ?? "").trim();
  const notas = obj.notas ? String(obj.notas) : undefined;
  const proyecto_clickup_id = obj.proyecto_clickup_id
    ? String(obj.proyecto_clickup_id).trim() || undefined
    : undefined;
  const proyecto_nombre = obj.proyecto_nombre
    ? String(obj.proyecto_nombre).trim() || undefined
    : undefined;
  const bufferRaw = obj.buffer_porcentaje;
  const buffer_porcentaje =
    bufferRaw == null || bufferRaw === ""
      ? 0
      : Number.isFinite(Number(bufferRaw)) && Number(bufferRaw) >= 0 && Number(bufferRaw) <= 100
      ? Number(bufferRaw)
      : 0;

  if (!programador_id) errors.push({ path: "programador_id", message: "Selecciona un estimador." });
  if (!nombre_solicitud)
    errors.push({ path: "nombre_solicitud", message: "Pon un nombre a la solicitud." });

  const tareasRaw = Array.isArray(obj.tareas) ? obj.tareas : [];
  if (tareasRaw.length === 0) errors.push({ path: "tareas", message: "Añade al menos una tarea." });

  const tareas: EstimacionPayload["tareas"] = [];
  tareasRaw.forEach((t: any, i: number) => {
    const nombre = String(t?.nombre ?? "").trim();
    const descripcion = String(t?.descripcion ?? "").trim();
    const hrs_min = Number(t?.hrs_min);
    const hrs_max = Number(t?.hrs_max);
    const masProbRaw = t?.hrs_mas_probable;
    const hrs_mas_probable =
      masProbRaw === "" || masProbRaw == null
        ? null
        : Number.isFinite(Number(masProbRaw))
        ? Number(masProbRaw)
        : null;

    if (!nombre) errors.push({ path: `tareas.${i}.nombre`, message: "Falta el nombre." });
    if (!Number.isFinite(hrs_min) || hrs_min < 0)
      errors.push({ path: `tareas.${i}.hrs_min`, message: "Mínimo inválido." });
    if (!Number.isFinite(hrs_max) || hrs_max < 0)
      errors.push({ path: `tareas.${i}.hrs_max`, message: "Máximo inválido." });
    if (Number.isFinite(hrs_min) && Number.isFinite(hrs_max) && hrs_max < hrs_min)
      errors.push({ path: `tareas.${i}.hrs_max`, message: "Máximo debe ser ≥ mínimo." });
    if (
      hrs_mas_probable !== null &&
      Number.isFinite(hrs_min) &&
      Number.isFinite(hrs_max) &&
      (hrs_mas_probable < hrs_min || hrs_mas_probable > hrs_max)
    )
      errors.push({
        path: `tareas.${i}.hrs_mas_probable`,
        message: "Más probable debe estar entre mín y máx.",
      });

    tareas.push({
      nombre,
      descripcion,
      hrs_min: Number.isFinite(hrs_min) ? hrs_min : 0,
      hrs_max: Number.isFinite(hrs_max) ? hrs_max : 0,
      hrs_mas_probable,
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    data: {
      programador_id,
      nombre_solicitud,
      notas,
      proyecto_clickup_id,
      proyecto_nombre,
      buffer_porcentaje,
      tareas,
    },
  };
}
