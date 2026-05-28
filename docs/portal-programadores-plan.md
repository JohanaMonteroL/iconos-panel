# Portal para programadores — Plan en pausa

Funcionalidad para que cada programador entre con su cuenta y vea sus propias
estimaciones (sin datos financieros). En pausa — se retoma después.

## Requerimientos confirmados con Johana

1. **Auth**: cada programador tiene cuenta propia con correo + contraseña.
   Johana setea contraseña temporal; el programador la cambia en el primer
   login. Johana también puede resetear cuando quiera.

2. **Permisos**: solo lectura sobre sus propias estimaciones. PERO desde su
   vista pueden crear estimaciones nuevas (reusar el form de captura).

3. **Visibilidad**:
   - Ve **todas** sus estimaciones sin importar estado (recibida, procesada,
     descartada, ya convertida en cotización).
   - Filtros por estado / etiquetas visuales.
   - **NO ve nada financiero** (precio interno, precio venta, ganancia,
     costo, monto fijo si aplica).
   - **Sí ve**: horas mín/PERT/máx originales, **horas finales enviadas
     al jefe (con buffer)**, fecha de creación, link al ticket de JIRA si
     la cotización fue aprobada y se generó.

4. **IA**: ve la **descripción limpia** post-IA por defecto, con opción de
   "ver original". **No ve la recomendación IA** (eso es solo para Johana
   porque a veces dice cosas como "considera aumentar horas").

5. **Dashboard**: contador de estimaciones totales, por estado, otros datos
   relevantes (pendientes futuros: tasa de aprobación, etc.).

6. **Diseño**: mobile + desktop. Vista limpia, con filtros y buscador
   incluidos.

## Decisiones futuras

- **Vacaciones**: módulo aparte para que el programador gestione sus
  vacaciones. Se hará después del portal base.

## Alcance del MVP (cuando se retome)

Phase 1 — Login + listado:
1. Migración 0013: `password_hash`, `must_change_password`, `ultimo_login_at`
   en programadores + índice único de `correo` (case-insensitive).
2. `lib/programador/auth.ts` — sesión separada (cookie `iconos_programador_session`),
   token HMAC con `programadorId`.
3. Endpoints:
   - `POST /api/programador/login` (correo + password)
   - `POST /api/programador/logout`
   - `POST /api/programador/cambiar-password` (requiere sesión, valida actual)
   - `POST /api/programadores/[id]/set-password` (solo Johana, fuerza
     `must_change_password = true`)
4. UI Settings de Johana: botón "Resetear contraseña" en cada programador
   que genera una temporal aleatoria (visible una vez) o le permite escribirla.
5. `/programador/login` — form correo + password.
6. `/programador/cambiar-password` — si `must_change_password=true` se
   redirige aquí obligatoriamente después del login.
7. Layout `/programador/*` con sidebar propio (con su nombre, link a
   logout, link a estimaciones, link a nueva estimación).
8. `/programador` — dashboard con contadores (total estimaciones, por
   estado, % aprobadas).
9. `/programador/estimaciones` — listado con:
   - Cards con nombre, badge de estado, horas enviadas si aplica, link
     a JIRA si aplica.
   - Filtros: estado.
   - Buscador por nombre / texto.
10. `/programador/estimaciones/[id]` — detalle:
    - Nombre, fecha, estado.
    - Tareas con horas min/max (limpias o originales con toggle).
    - Horas finales enviadas + buffer aplicado.
    - Link al ticket JIRA si la cotización fue aprobada.
    - **Sin** financiero, **sin** recomendación IA, **sin** borrador
      correo, **sin** contexto Sherlyn.
11. `/programador/estimaciones/nueva` — reusa el form público
    (`EstimacionForm`) pero con el programador ya pre-seleccionado y
    bloqueado (no puede enviar como otro).

Phase 2 — Vacaciones (después):
- Esquema para vacaciones.
- UI para solicitar.
- Aprobación de Johana.

## Estado al pausar

- ✅ Migración 0013 creada en `supabase/migrations/0013_programadores_auth.sql`
- ✅ `lib/programador/auth.ts` creado con helpers de sesión + lookup
- ⏸ Pendiente: endpoints, UI Settings, layout `/programador/*`, todas
  las páginas.

## Para retomar

1. Aplicar migración 0013 en Supabase (no urgente — el código no la usa
   todavía).
2. Continuar con los endpoints de login/logout/cambiar-password.
3. Settings UI para que Johana genere contraseñas temporales.
4. Páginas del portal.
