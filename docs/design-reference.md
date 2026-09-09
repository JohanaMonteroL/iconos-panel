# Design Reference Document — ICONOS Panel
> Versión 2.0 · Septiembre 2026 — Rediseño basado en mockups de Claude Design

---

## 1. Filosofía de Diseño

Limpio, denso en información pero sin saturar. Superficies blancas sobre un fondo gris neutro, bordes finos en vez de sombras marcadas, acentos de color solo para estado (éxito/alerta/error) y para el acento de marca (índigo). Los números siempre alineados y en fuente monoespaciada.

**Principios:**
- **Jerarquía por peso y tamaño**, no por color — el negro (`--text-primary`) manda, el gris hace de soporte.
- **Tarjetas ligeras** — borde sutil + sombra casi imperceptible en reposo; la sombra crece solo en hover para señalar interactividad (KPIs, tarjetas de kanban).
- **Pills para estado** — todo estado (aprobado, vencido, borrador…) es una píldora de radio completo con fondo suave y texto saturado del mismo tono.
- **Densidad controlada** — tablas con padding generoso pero texto compacto (12.5px), para caber muchas columnas sin sensación de hacinamiento.

---

## 2. Tipografía

### Familias
- **DM Sans** — texto general (headings, body, labels).
- **Geist Mono** — cualquier valor numérico: montos, horas, folios, tarifas.

```
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Geist+Mono:wght@400;500&display=swap');
```

### Escala tipográfica

| Rol              | Tamaño   | Peso | Tracking  | Uso                                  |
|------------------|----------|------|-----------|---------------------------------------|
| Display          | 27px     | 600  | -0.02em   | Títulos de página (`<h1>`)            |
| Heading 1        | 20px     | 600  | -0.01em   | Títulos de sección grandes            |
| Heading 2        | 14.5px   | 600  | 0em       | Títulos de card, sub-secciones        |
| Body             | 14px     | 400  | 0em       | Contenido general                     |
| Body Medium      | 14px     | 500  | 0em       | Labels de campo, datos clave          |
| Tabla / Card body| 12.5px   | 400  | 0em       | Filas de tabla, texto denso            |
| Caption          | 12px     | 400  | 0.01em    | Metadatos, fechas, ayudas              |
| Overline         | 10.5px   | 600  | 0.08em    | Encabezados de tabla y de grupo (ALL CAPS) |
| Mono             | 13px     | 400  | 0em       | Folios, tarifas, horas, montos        |

### Reglas tipográficas
- Line-height base: `1.5` para body, `1.2` para headings.
- `font-variant-numeric: tabular-nums` en `<body>` (global) — no hace falta aplicarlo por columna.
- KPI value: 27px / 600 / letter-spacing -1.1px.
- No usar más de 2 pesos tipográficos en una misma vista.

---

## 3. Color

### Modo Claro

```css
:root {
  --bg-base:        #F4F4F5;
  --bg-surface:     #FAFAFA;
  --bg-elevated:    #FFFFFF;
  --bg-overlay:     #F1F1F3;
  --bg-input:       #FFFFFF;

  --border-subtle:  #ECECEE;
  --border-faint:   #F1F1F3;
  --border-default: #E4E4E7;
  --border-strong:  #C4C4C8;

  --text-primary:   #18181B;
  --text-secondary: #52525B;
  --text-tertiary:  #A1A1AA;
  --text-disabled:  #D4D4D8;
  --text-inverse:   #FFFFFF;

  --accent:       #4F46E5;
  --accent-hover: #3730A3;

  --action-primary-bg:      #18181B;
  --action-primary-text:    #FFFFFF;
  --action-primary-hover:   #3F3F46;

  --action-secondary-bg:    transparent;
  --action-secondary-text:  #18181B;
  --action-secondary-border:#E4E4E7;
  --action-secondary-hover: #FAFAFA;

  --action-danger-bg:       #DC2626;
  --action-danger-text:     #FFFFFF;

  --state-success:  #16A34A;
  --state-warning:  #B45309;
  --state-error:    #DC2626;
  --state-info:     #1D4ED8;

  --shadow-sm:  0 1px 2px rgba(24, 24, 27, 0.03);
  --shadow-md:  0 10px 24px rgba(24, 24, 27, 0.08);
  --shadow-lg:  0 8px 24px rgba(24, 24, 27, 0.12);
}
```

### Modo Oscuro

```css
[data-theme="dark"] {
  --bg-base:        #18181B;
  --bg-surface:     #202023;
  --bg-elevated:    #232326;
  --bg-overlay:     #2A2A2E;
  --bg-input:       #232326;

  --border-subtle:  #2A2A2E;
  --border-faint:   #27272A;
  --border-default: #3F3F46;
  --border-strong:  #52525B;

  --text-primary:   #F4F4F5;
  --text-secondary: #A1A1AA;
  --text-tertiary:  #71717A;
  --text-disabled:  #52525B;
  --text-inverse:   #18181B;

  --accent:       #818CF8;
  --accent-hover: #A5B4FC;

  --action-primary-bg:      #F4F4F5;
  --action-primary-text:    #18181B;
  --action-primary-hover:   #FFFFFF;

  --action-secondary-bg:    transparent;
  --action-secondary-text:  #F4F4F5;
  --action-secondary-border:#3F3F46;
  --action-secondary-hover: #2A2A2E;

  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md:  0 10px 24px rgba(0, 0, 0, 0.4);
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.5);
}
```

---

## 4. Espaciado

Sistema basado en múltiplos de **4px** (sin cambios respecto a v1).

| Token       | Valor | Uso principal                                 |
|-------------|-------|-----------------------------------------------|
| `--space-1` | 4px   | Gap mínimo, separación interna de badges      |
| `--space-2` | 8px   | Padding de chips, gap icon+label              |
| `--space-3` | 12px  | Padding horizontal de inputs pequeños, padding de nav item |
| `--space-4` | 16px  | Padding de inputs, gap entre campos           |
| `--space-5` | 18-20px | Padding interno de cards                    |
| `--space-6` | 24px  | Espaciado entre secciones dentro de una card  |
| `--space-8` | 32px  | Separación entre secciones de página          |

---

## 5. Componentes

### Botones

**Primario (negro/blanco)** — alto 36px, padding 0 14px, radius 9px, peso 500, tamaño 12.5px.
**Secundario (outline)** — mismo tamaño, sin fondo, borde `--border-default`.

**Reglas:**
- Solo 1 acción primaria por vista/card.
- Acciones secundarias a la izquierda del primario.
- Nunca sombra en botones.
- Estados: hover (oscurecimiento leve), active (scale 0.98), disabled (opacity 0.4).

---

### Inputs y Campos

Alto 36px, radius 9px, border `--border-default`, texto 13px. Focus: borde strong + ring sutil.

**Label de campo:** 11.5px, peso 600, color `--text-secondary`, margen abajo 6px.

---

### Cards / Paneles

`background: --bg-elevated; border: 1px solid --border-default; border-radius: 14px; padding: 18px; box-shadow: --shadow-sm;`

Cards "interactivas" (KPIs, kanban, filas clicables) usan `.card-hover`: en hover, `box-shadow: --shadow-md`, `transform: translateY(-2px)`, borde a `--border-strong`. Transición 200ms.

---

### Tablas

Header: 10.5px / peso 600 / `--text-tertiary` / uppercase / tracking 0.05em / fondo `--bg-surface` / border-bottom `--border-faint` / padding 10px 8px.
Data row: 12.5px / `--text-primary` / padding 12px 8px / border-bottom `--border-faint`. Hover: `--bg-surface`.
Columnas numéricas y de folio: `text-align: right` (numéricas) + fuente `Geist Mono`.
Fila de totales: fondo `--bg-surface`, peso 600.

---

### Sidebar

Ancho 240px, fondo `--bg-surface`, border-right `--border-default`.

**Header del sidebar:** logo 36×36px, radius 11px, fondo `--action-primary-bg`, iniciales blancas peso 700 ("IC"), + nombre de la app + subtítulo pequeño en `--text-tertiary`.

**Nav item:** alto 38px, padding 0 12px, radius 11px, 13.5px, color `--text-secondary`, ícono 17px stroke 1.7 (Lucide). Hover: bg `--bg-overlay`. Activo: bg `--bg-elevated` + `--shadow-sm` + peso 600 + barra vertical de 3px en `--accent` pegada al borde izquierdo (offset -12px, altura 18px, radius 0 3px 3px 0).

**Badge de contador** (ej. pendientes): fondo `--accent`, texto blanco, píldora, 11px peso 600.

---

### Badges / Píldoras de estado

Alto 20px, padding 0 9px, radius 999px (pill), 11px / peso 500.

- Success / Pagado: bg `#DCFCE7`, texto `#16A34A`
- Neutral / Borrador: bg `--bg-overlay`, texto `--text-secondary`
- Danger / Vencido: bg `#FEE2E2`, texto `#DC2626`
- Warning / Pendiente: bg `#FEF9C3`, texto `#92400E`
- Info: bg `#DBEAFE`, texto `#1D4ED8`

Dark mode: mismo tono al 16% de opacidad sobre fondo oscuro, texto en la variante clara del color (ej. `#4ADE80` para success).

---

## 6. Iconografía

Lucide Icons (stroke). Tamaño base 16-17px según contexto (17px en nav / navegación principal, 16px en botones y acciones inline, 20px en avatares/acciones prominentes). Stroke-width 1.5-1.7. Color heredado, opacidad 0.9 quando acompaña texto en nav. Sin íconos decorativos.

---

## 7. Layout

```
┌────────────────┬──────────────────────────┐
│ Sidebar 240px  │ Main (flex-1)            │
│  Logo 36px     │  ┌────────────────────┐  │
│  Nav items     │  │ Header sticky/blur │  │
│  Footer        │  ├────────────────────┤  │
│                │  │ Content            │  │
│                │  └────────────────────┘  │
└────────────────┴──────────────────────────┘
```

Grids de KPIs: `repeat(auto-fit, minmax(210px, 1fr))`, gap 14px.
Form grid: 2 col en campos pares, 1 col en campos largos. Gap 15px.

---

## 8. Animación

Funcional, no decorativa.

| Caso              | Duración | Easing                   |
|-------------------|----------|--------------------------|
| Hover             | 120-200ms| ease                     |
| Card hover (lift) | 200ms    | ease                     |
| Focus rings       | 120ms    | ease                     |
| Dropdown open     | 150ms    | ease-out                 |
| Modal enter       | 200ms    | cubic-bezier(.16,1,.3,1) |
| Entrada de vista  | 340ms    | cubic-bezier(.4,0,.2,1)  |

Respetar `prefers-reduced-motion: reduce`.

---

## 9. Tema (Dark/Light)

- `@media (prefers-color-scheme: dark)` auto.
- Override via `[data-theme="..."]` desde toggle.
- Persistir en `localStorage('theme')`.
- Aplicar tema antes del primer render (script inline en `<head>`).

---

## 10. Checklist de Calidad

Antes de entregar cualquier vista:

- [ ] ¿Textos secundarios usan `--text-secondary`, terciarios `--text-tertiary`?
- [ ] ¿Bordes usan `--border-default` (cards/inputs) o `--border-faint`/`--border-subtle` (separadores internos)?
- [ ] ¿Funciona en modo oscuro sin colores hardcodeados (excepto los de badges, que ya tienen su variante dark)?
- [ ] ¿Montos, horas, folios y tarifas en `Geist Mono`?
- [ ] ¿Solo 1 acción primaria visible por card/vista?
- [ ] ¿Íconos Lucide a 17px / stroke 1.7 en nav, 16px en el resto?
- [ ] ¿`prefers-reduced-motion` implementado?
- [ ] ¿Cards interactivas usan `.card-hover` (lift + shadow), no hover en cards estáticas?

---

## Notas de migración (v1 → v2)

- Se reemplaza Google Sans Flex por **DM Sans** + **Geist Mono** para valores numéricos.
- El fondo base pasa de blanco puro a gris neutro `#F4F4F5`, y las cards son blancas puras sobre ese fondo (antes era al revés).
- Los radios de card suben de 12px → 14px; botones e inputs bajan de 10px → 9px.
- Se agrega el token `--accent` (índigo `#4F46E5`) para la barra de nav activo y usos puntuales de color de marca — no reemplaza `--state-info`.
- No se modificó el ancho máximo de contenido (`container-app`, 960px) ni la estructura de rutas: este rediseño es solo de superficie (tokens, tipografía, radios, sidebar, tabla, badges, botones). Cambios de layout/estructura de página se evalúan por separado.
