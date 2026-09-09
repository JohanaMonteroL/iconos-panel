// Tipos del modelo de datos (PRD sección 11)
// Espejo simple del esquema SQL — para usar hasta generar types con la CLI de Supabase.

export type Programador = {
  id: string;
  nombre: string;
  slack_id: string | null;
  precio_hora: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Cliente = {
  id: string;
  nombre: string;
  created_at: string;
};

export type Proyecto = {
  id: string;
  cliente_id: string | null;
  nombre: string;
  clickup_id: string | null;
  precio_hora_venta: number;
  created_at: string;
  updated_at: string;
};

export type ContactoCorreo = {
  id: string;
  proyecto_id: string;
  nombre_contacto: string;
  email: string;
  rol: string | null;
  created_at: string;
};

export type CanalEntrada = "whatsapp" | "correo" | "llamada" | "otro" | "formulario";
// Espejo de lib/estados — importar de ahí (ESTADOS_COTIZACION/EstadoCotizacion)
// para lógica; este alias solo existe para tipar la fila de la tabla.
export type EstadoCotizacion =
  | "por_estimar"
  | "pendiente_revision_interna"
  | "esperando_aprobacion"
  | "cambios_solicitados"
  | "enviada"
  | "aprobada"
  | "en_desarrollo"
  | "en_espera_de_cobro"
  | "pendiente_por_cobrar"
  | "rechazada"
  | "cobrada"
  | "archivada";
export type Prioridad = "alta" | "media" | "baja";

export type Cotizacion = {
  id: string;
  nombre: string;
  nombre_original: string | null;
  cliente_id: string | null;
  proyecto_id: string | null;
  proyecto_clickup_id: string | null;
  proyecto_nombre: string | null;
  canal_entrada: CanalEntrada | null;
  descripcion_original: string | null;
  descripcion_limpia: string | null;
  programador_id: string | null;
  horas_min: number;
  horas_max: number;
  horas_envio: number | null;
  horas_envio_tipo: string | null;
  buffer_porcentaje: number | null;
  notas_programador: string | null;
  precio_venta_hora: number | null;
  slack_text: string | null;
  prioridad: Prioridad | null;
  estado: EstadoCotizacion;
  clickup_ticket_id: string | null;
  jira_ticket_ids: string[] | null;
  estimacion_formulario_id: string | null;
  ia_recomendacion: string | null;
  borrador_correo: string | null;
  contexto_sherlyn: string | null;
  slack_message_ts: string | null;
  jefe_aprobacion_solicitada_at: string | null;
  jefe_aprobacion_recibida_at: string | null;
  recordatorio_enviado_at: string | null;
  revisada_at: string | null;
  // Detalle de envío (Fase 2) — se llenan al subir el PDF y marcar "Enviada".
  envio_pdf_path: string | null;
  envio_pdf_nombre_original: string | null;
  envio_horas_totales: number | null;
  envio_costo_aproximado: number | null;
  envio_estimado_por: string | null;
  envio_fecha: string | null;
  created_at: string;
  updated_at: string;
};

export type TareaEstimacion = {
  id: string;
  cotizacion_id: string;
  orden: number;
  nombre_original: string;
  nombre_limpio: string | null;
  descripcion_original: string | null;
  descripcion_limpia: string | null;
  hrs_min: number;
  hrs_max: number;
  hrs_implementacion: number | null;
  hrs_pruebas: number | null;
  hrs_juntas: number | null;
  created_at: string;
};

// Histórico — ya no recibe escrituras nuevas desde la fusión Cotizaciones +
// Estimaciones (todo registro nuevo nace directo en `cotizaciones`). Se
// conserva la tabla y este tipo solo para leer registros viejos; `estado`
// refleja el vocabulario post-migración 0003 (no el de la creación de la
// tabla en 0001).
export type EstimacionFormulario = {
  id: string;
  programador_id: string | null;
  cotizacion_ref: string | null;
  datos_raw: unknown;
  datos_limpios: unknown | null;
  ia_recomendacion: string | null;
  estado: "recibida" | "procesada_ia" | "descartada";
  revisada_at: string | null;
  created_at: string;
};

export type AccionCotizacion = {
  id: string;
  cotizacion_id: string;
  tipo_accion: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_label: string | null;
  created_at: string;
};
