# Pendientes para después

Funcionalidades que ya están diseñadas pero pospuestas a versiones posteriores.

## A. Cerrar el flujo Sherlyn → cliente

Cuando se aprueba una cotización (por Iván o por Johana), Sherlyn recibe un DM
pero hoy no incluye los datos del cliente. Falta:

- **Contactos por proyecto**: guardar uno o más correos del cliente asociados
  al proyecto. CRUD en Settings o desde el detalle del proyecto.
- **DM a Sherlyn enriquecido**: nombre y correo del cliente + borrador de
  correo (de `datos_limpios.borrador_correo`) + total de horas + link a
  ClickUp del ticket.
- Mejorar botón "Marcar como enviada al cliente" con campo de fecha de
  envío real para registro.

## B. Recordatorio al jefe a las 24h

Si Iván no responde el mensaje de Slack de aprobación en 24h, mandar ping
automático.

- Cron en Vercel (1 vez al día — ver `vercel.json` `crons`).
- Endpoint que busque cotizaciones en `esperando_aprobacion` con
  `jefe_aprobacion_solicitada_at > 24h atrás` y reenvíe el mensaje (o uno
  más breve recordatorio) al canal admin.

## C. Métricas e historial

Pantalla con KPIs de la semana/mes:

- Cotizaciones enviadas, aprobadas, rechazadas.
- Montos totales por programador / por mes.
- Tiempo promedio de aprobación (tiempo entre `solicitada_at` y
  `recibida_at`).
- Ratio de aprobación.

Útil para Johana y para mostrarle a Iván.

## D. Edición post-aprobación / versiones

Hoy si el cliente pide cambios después de que la cotización quedó aprobada,
no hay flow claro. Necesita:

- Botón "Crear versión 2" que clone la cotización con incrementador de
  versión.
- Vincular versiones entre sí (campo `cotizacion_padre_id`).
- En el log de la cotización mostrar el árbol de versiones.

## E. Fase 2 — Paso a desarrollo (JIRA)

Cuando una cotización pasa a "aprobada" o "enviada al cliente":

- Opción de crear ticket en JIRA (o asignarse en JIRA si ya existe).
- Cambiar carril en ClickUp a "En desarrollo".
- Asignar a un desarrollador desde el panel.
- Sincronizar el progreso entre JIRA / ClickUp y el panel.

Esto es el mayor de los pendientes — implica integrar otra API completa.
