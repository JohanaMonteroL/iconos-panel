// Block Kit builders para los mensajes interactivos.
// Docs: https://api.slack.com/block-kit

import type { SlackBlock } from "./client";

/**
 * Mensaje al jefe para revisar una cotización.
 * Body: el texto mrkdwn que ya generamos.
 * Buttons: Aprobar / Pedir cambios.
 */
export function blocksAprobacionCotizacion(
  textoMrkdwn: string,
  cotizacionId: string,
  clickupUrl?: string | null
): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: textoMrkdwn },
    },
  ];

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
