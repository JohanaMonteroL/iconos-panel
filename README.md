# ICONOS Panel

PWA mobile-first para automatizar el flujo de cotizaciones y desarrollo de ICONOS.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase · Vercel.

## Setup

```bash
npm install
cp .env.local.example .env.local   # llenar valores
npm run dev
```

## Estructura

```
app/
  api/                # endpoints REST y webhooks
  estimaciones/nueva  # formulario público para programadores
  login/              # autenticación admin
  panel/              # área privada de Johana (admin)
    cotizaciones/
    contactos/
    estimaciones/
    settings/
lib/
  supabase/   # clientes browser / server / service-role
  anthropic/  # IA (Claude) — limpieza y borradores
  clickup/    # cliente REST
  slack/      # bot + webhooks
  jira/       # cliente REST + webhooks
  clockify/   # lectura de tiempo
  push/       # Web Push API (VAPID)
components/   # UI compartida
supabase/migrations/  # SQL versionado
types/        # tipos del modelo de datos
```

## Base de datos

Migración inicial en `supabase/migrations/0001_initial_schema.sql`.
Aplicar con la CLI de Supabase o pegar en el SQL Editor del dashboard.

## Variables de entorno

Ver `.env.local.example`.

## Plan de construcción

Ver PRD §13.3. Semana 1 (este commit): proyecto base, Tailwind, estructura, esquema SQL.
