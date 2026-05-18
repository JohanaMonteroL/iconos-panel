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
export type EstadoCotizacion =
  | "pendiente_revisar"
  | "esperando_aprobacion"
  | "aprobada"
  | "cambios_solicitados"
  | "en_desarrollo"
  | "enviada_cliente"
  | "archivada";
export type Prioridad = "alta" | "media" | "baja";

export type Cotizacion = {
  id: string;
  nombre: string;
  cliente_id: string | null;
  proyecto_id: string | null;
  proyecto_clickup_id: string | null;
  canal_entrada: CanalEntrada | null;
  descripcion_original: string | null;
  descripcion_limpia: string | null;
  programador_id: string | null;
  horas_min: number;
  horas_max: number;
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

export type EstimacionFormulario = {
  id: string;
  programador_id: string | null;
  cotizacion_ref: string | null;
  datos_raw: unknown;
  datos_limpios: unknown | null;
  ia_recomendacion: string | null;
  estado: "recibida" | "en_revision" | "procesada" | "descartada";
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
