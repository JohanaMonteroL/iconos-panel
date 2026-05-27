// Block Kit builders para los mensajes interactivos.
// Docs: https://api.slack.com/block-kit

import type { SlackBlock } from "./client";

/**
 * Mensaje al jefe para revisar una cotización.
 * Body: el texto mrkdwn que ya generamos.
 * Buttons: Aprobar / Pedir cambios.
 *
 * Si `opts.comoActualizacion` es true, añade un banner arriba indicando que
 * la cotización tuvo cambios y se está reenviando para revisión.
 */
export function blocksAprobacionCotizacion(
  textoMrkdwn: string,
  cotizacionId: string,
  clickupUrl?: string | null,
  opts?: { comoActualizacion?: boolean; notaCambios?: string | null }
): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  if (opts?.comoActualizacion) {
    const nota = opts.notaCambios?.trim();
    const textoBanner = nota
      ? `🔄 *Cotización actualizada* — ${nota}`
      : "🔄 *Cotización actualizada* — se hicieron cambios, revísala de nuevo.";
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: textoBanner },
    });
    blocks.push({ type: "divider" });
  }

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: textoMrkdwn },
  });

  if (clickupUrl) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🔗 <${clickupUrl}|Ver ticket en ClickUp>`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    block_id: `cotizacion_${cotizacionId}`,
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "✅ Aprobar" },
        style: "primary",
        value: cotizacionId,
        action_id: "aprobar_cotizacion",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "✏️ Pedir cambios" },
        value: cotizacionId,
        action_id: "pedir_cambios_cotizacion",
      },
    ],
  });

  return blocks;
}

/**
 * Bloques para el DM al programador cuando se le asigna un ticket.
 * Si es un reasignación (no creación nueva), pasa `actualizacion: true` para
 * que muestre un banner distinto.
 */
const PRIORIDAD_EMOJI: Record<string, string> = {
  highest: "🔥",
  high: "🔺",
  medium: "🔷",
  low: "🔻",
  lowest: "⬇️",
};

const TIPO_EMOJI: Record<string, string> = {
  estimacion: "🧮",
  desarrollo: "💻",
  soporte: "🛠️",
  investigacion: "🔍",
};

export function blocksTicketAsignado(input: {
  titulo: string;
  jiraKey: string;
  jiraUrl: string;
  tipo: string; // estimacion|desarrollo|soporte|investigacion
  prioridad: string; // highest|high|medium|low|lowest
  horasEstimadas?: number | null;
  proyectoNombre?: string | null;
  descripcionMd?: string | null;
  enviadoPor?: string | null; // Johana
  actualizacion?: boolean;
}): SlackBlock[] {
  const headerEmoji = input.actualizacion ? "🔄" : "📋";
  const headerTexto = input.actualizacion
    ? `Ticket reasignado a ti — ${input.jiraKey}`
    : `Nuevo ticket asignado — ${input.jiraKey}`;

  const detalles: string[] = [];
  detalles.push(
    `${TIPO_EMOJI[input.tipo] ?? "📝"} *Tipo:* ${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)}`
  );
  detalles.push(
    `${PRIORIDAD_EMOJI[input.prioridad] ?? "•"} *Prioridad:* ${input.prioridad}`
  );
  if (input.horasEstimadas != null && input.horasEstimadas > 0) {
    detalles.push(`⏱️ *Horas estimadas:* ${input.horasEstimadas}h`);
  }
  if (input.proyectoNombre) {
    detalles.push(`📁 *Proyecto:* ${input.proyectoNombre}`);
  }

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${headerEmoji} ${headerTexto}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${input.titulo}*` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: detalles.join("\n") },
    },
  ];

  if (input.descripcionMd && input.descripcionMd.trim()) {
    // Slack tiene un límite de 3000 caracteres por bloque section.
    const desc = input.descripcionMd.trim().slice(0, 2800);
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: desc },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "🔗 Abrir en JIRA" },
        url: input.jiraUrl,
        style: "primary",
      },
    ],
  });

  if (input.enviadoPor) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Asignado por ${input.enviadoPor}`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Mensaje para Sherlyn cuando la cotización fue aprobada.
 */
export function blocksNotificacionSherlyn(
  nombre: string,
  proyecto: string | null,
  clickupUrl: string | null,
  horas: number
): SlackBlock[] {
  const lineas: string[] = [
    "🎉 *Cotización aprobada — lista para enviar al cliente*",
    "",
    `*Nombre:* ${nombre}`,
  ];
  if (proyecto) lineas.push(`*Proyecto:* ${proyecto}`);
  lineas.push(`*Tiempo:* ${horas} horas`);
  if (clickupUrl) lineas.push(`<${clickupUrl}|Ver en ClickUp>`);

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: lineas.join("\n") },
    },
  ];
}

/**
 * Mensaje breve de status que reemplaza el mensaje original cuando la
 * cotización ya fue resuelta (para que los botones desaparezcan).
 */
export function blocksMensajeResuelto(
  textoOriginal: string,
  accion: "aprobada" | "cambios_solicitados",
  comentario?: string | null
): SlackBlock[] {
  const banner =
    accion === "aprobada"
      ? "✅ *Aprobada*"
      : `✏️ *Cambios solicitados*${comentario ? `\n_${comentario}_` : ""}`;

  return [
    { type: "section", text: { type: "mrkdwn", text: banner } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: textoOriginal } },
  ];
}
