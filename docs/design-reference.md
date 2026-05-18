# Design Reference Document — ICONOS Panel
> Versión 1.0 · Mayo 2026

---

## 1. Filosofía de Diseño

Limpio, funcional, sin fricciones. Inspirado en la claridad de Notion: cada elemento existe por una razón, el espacio en blanco es intencional, la jerarquía es inmediata. No hay decoración gratuita.

**Principios:**
- **Claridad sobre expresión** — El contenido manda, la UI se quita del camino.
- **Consistencia estructural** — Mismos patrones, mismas distancias, sin sorpresas.
- **Acción evidente** — Siempre queda claro qué hacer a continuación.
- **Densidad controlada** — Información completa sin saturación visual.

---

## 2. Tipografía

### Familia principal
**Google Sans Flex** — Variable font, permite ajuste fino de peso y ancho.

```
@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@100..900&display=swap');
```

### Escala tipográfica

| Rol              | Tamaño  | Peso | Tracking  | Uso                          |
|------------------|---------|------|-----------|------------------------------|
| Display          | 28px    | 600  | -0.02em   | Títulos de página            |
| Heading 1        | 20px    | 600  | -0.01em   | Títulos de sección           |
| Heading 2        | 15px    | 600  | 0em       | Sub-secciones, labels grupo  |
| Body             | 14px    | 400  | 0em       | Contenido general            |
| Body Medium      | 14px    | 500  | 0em       | Labels de campo, datos clave |
| Caption          | 12px    | 400  | 0.01em    | Metadatos, fechas, ayudas    |
| Overline         | 11px    | 500  | 0.08em    | Etiquetas de categoría (ALL CAPS) |
| Mono             | 13px    | 400  | 0em       | Números de factura, códigos  |

### Reglas tipográficas
- Line-height base: `1.5` para body, `1.2` para headings.
- Números: usar `font-variant-numeric: tabular-nums` en columnas de tabla.
- Máximo de caracteres por línea en párrafos: 72ch.
- No usar más de 2 pesos tipográficos en una misma vista.

---

## 3. Color

### Modo Claro

```css
:root {
  --bg-base:        #FFFFFF;
  --bg-surface:     #F7F7F5;
  --bg-elevated:    #FFFFFF;
  --bg-overlay:     #F0F0EE;
  --bg-input:       #FFFFFF;

  --border-subtle:  #E8E8E6;
  --border-default: #D4D4D2;
  --border-strong:  #ADADAB;

  --text-primary:   #1A1A1A;
  --text-secondary: #6B6B6B;
  --text-tertiary:  #ADADAB;
  --text-disabled:  #C9C9C7;
  --text-inverse:   #FFFFFF;

  --action-primary-bg:      #1A1A1A;
  --action-primary-text:    #FFFFFF;
  --action-primary-hover:   #000000;

  --action-secondary-bg:    transparent;
  --action-secondary-text:  #1A1A1A;
  --action-secondary-border:#D4D4D2;
  --action-secondary-hover: #F0F0EE;

  --action-danger-bg:       #FF3B30;
  --action-danger-text:     #FFFFFF;

  --state-success:  #22C55E;
  --state-warning:  #F59E0B;
  --state-error:    #EF4444;
  --state-info:     #3B82F6;

  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md:  0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.10);
}
```

### Modo Oscuro

```css
[data-theme="dark"] {
  --bg-base:        #191919;
  --bg-surface:     #212121;
  --bg-elevated:    #262626;
  --bg-overlay:     #2E2E2E;
  --bg-input:       #212121;

  --border-subtle:  #2E2E2E;
  --border-default: #3A3A3A;
  --border-strong:  #525252;

  --text-primary:   #EBEBEB;
  --text-secondary: #9E9E9E;
  --text-tertiary:  #616161;
  --text-disabled:  #4A4A4A;
  --text-inverse:   #1A1A1A;

  --action-primary-bg:      #EBEBEB;
  --action-primary-text:    #1A1A1A;
  --action-primary-hover:   #FFFFFF;

  --action-secondary-bg:    transparent;
  --action-secondary-text:  #EBEBEB;
  --action-secondary-border:#3A3A3A;
  --action-secondary-hover: #2E2E2E;

  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md:  0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.5);
}
```

---

## 4. Espaciado

Sistema basado en múltiplos de **4px**.

| Token       | Valor | Uso principal                                 |
|-------------|-------|-----------------------------------------------|
| `--space-1` | 4px   | Gap mínimo, separación interna de badges      |
| `--space-2` | 8px   | Padding de chips, gap icon+label              |
| `--space-3` | 12px  | Padding horizontal de inputs pequeños         |
| `--space-4` | 16px  | Padding de inputs, gap entre campos           |
| `--space-5` | 20px  | Padding interno de cards                      |
| `--space-6` | 24px  | Espaciado entre secciones dentro de una card  |
| `--space-8` | 32px  | Separación entre secciones de página          |
| `--space-10`| 40px  | Padding de contenedor principal               |
| `--space-12`| 48px  | Separación entre bloques mayores              |

---

## 5. Componentes

### Botones

**Primario (negro/blanco)** — alto 36px, padding 0 16px, radius 8px, peso 500.
**Secundario (outline)** — mismo tamaño, sin fondo, borde sutil.

**Reglas:**
- Solo 1 acción primaria por vista.
- Acciones secundarias a la izquierda del primario.
- Botones con ícono: gap 6px, ícono 16px.
- Nunca sombra en botones.
- Estados: hover (oscurecimiento leve), active (scale 0.98), disabled (opacity 0.4).

---

### Inputs y Campos

Alto 36px, radius 8px, border default. Focus: borde strong + ring sutil (rgba 0.06).

**Label de campo:** 12px, peso 500, color `--text-secondary`, margen abajo 6px.

---

### Cards / Paneles

`background: --bg-elevated; border: 1px solid --border-subtle; border-radius: 12px; padding: 20px 24px; box-shadow: --shadow-sm;`

En modo oscuro: borde sutil sustituye a sombra.

---

### Tablas

Header: 11px / peso 500 / `--text-tertiary` / uppercase / tracking 0.06em / border-bottom sutil / padding 8px 0.
Data row: 14px / `--text-primary` / padding 10px 0 / border-bottom sutil. Hover: `--bg-overlay`.
Columnas numéricas: text-align right, `font-variant-numeric: tabular-nums`.

---

### Sidebar

Ancho 240px, fondo `--bg-surface`, border-right sutil.

Nav item: alto 32px, padding 0 12px, radius 6px, 14px, color `--text-secondary`. Hover/activo: bg `--bg-overlay`, color `--text-primary`. Icon 16px, gap 8px.

---

### Badges

Alto 20px, padding 0 8px, radius 4px, 11px / peso 500.

- Paid: bg #DCFCE7, text #16A34A
- Draft: bg `--bg-overlay`, text `--text-secondary`
- Overdue: bg #FEE2E2, text #DC2626
- Pending: bg #FEF9C3, text #92400E

Dark mode: bg al 20% sobre base oscura.

---

## 6. Iconografía

Lucide Icons (stroke). Tamaño base 16px (20px en acciones prominentes). Stroke-width 1.5. Color heredado. Sin íconos decorativos.

---

## 7. Layout

```
┌────────────────┬──────────────────────────┐
│ Sidebar 240px  │ Main (flex-1)            │
│                │  ┌────────────────────┐  │
│                │  │ Header (40px pad)  │  │
│                │  ├────────────────────┤  │
│                │  │ Content (max 960)  │  │
│                │  └────────────────────┘  │
└────────────────┴──────────────────────────┘
```

Form grid: 2 col en campos pares, 1 col en campos largos. Gap 16px col / 20px row.

Ancho máx de contenido: **960px** centrado.

---

## 8. Animación

Funcional, no decorativa.

| Caso              | Duración | Easing                   |
|-------------------|----------|--------------------------|
| Hover             | 120ms    | ease                     |
| Focus rings       | 120ms    | ease                     |
| Dropdown open     | 150ms    | ease-out                 |
| Modal enter       | 200ms    | cubic-bezier(.16,1,.3,1) |
| Toast             | 250ms    | ease-out                 |
| Page transition   | 180ms    | ease                     |

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

- [ ] ¿Espaciados múltiplos de 4?
- [ ] ¿Solo 1 acción primaria visible?
- [ ] ¿Textos secundarios usan `--text-secondary`?
- [ ] ¿Bordes usan `--border-subtle` o `--border-default`?
- [ ] ¿Funciona en modo oscuro sin colores hardcodeados?
- [ ] ¿Números en tabla usan `tabular-nums`?
- [ ] ¿Foco visible sin sombra excesiva?
- [ ] ¿`prefers-reduced-motion` implementado?
- [ ] ¿Íconos Lucide a 16px / 1.5 stroke?
- [ ] ¿Ancho máx 960px respetado?
