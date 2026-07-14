# Design Tokens — Plataforma Préstamo de Kits Arduino (UCN)

Identidad visual congelada, basada en el **Manual de Marca UCN** (paleta y tipografía
oficiales). Fuente de verdad para el frontend. Todo lo que sea color/tipografía debe
salir de aquí — nada hardcodeado suelto en componentes.

Decisiones tomadas:
- Logo: **institucional estándar** (sello + wordmark). NO el de "70 años" (caduca en 2027).
- Tipografía: **Source Sans 3** (sustituto web libre de Myriad Pro, la fuente oficial).

---

## 1. Paleta institucional (del manual — NO modificar)

| Color        | Hex       | Rol en la UI                          |
|--------------|-----------|---------------------------------------|
| Navy         | `#151f3f` | Header, sidebar, texto fuerte         |
| Blue (primary) | `#166499` | Botones primarios, links, estado activo |
| Sky          | `#7c9ac0` | Hover suave, bordes, acentos          |
| Terracota    | `#bb6125` | Acento fuerte / destacados            |
| Ocre         | `#a56829` | Secundario cálido                     |
| Ámbar        | `#d5a140` | Highlights, métricas, estado "prestado" |

## 2. Colores funcionales (capa añadida — no son de marca)

Necesarios para una app de gestión. Elegidos para convivir con la paleta:

| Rol          | Hex       | Uso                                            |
|--------------|-----------|------------------------------------------------|
| Success      | `#2e7d32` | Componente/kit devuelto, cuenta habilitada     |
| Warning      | `#d5a140` | Préstamo pendiente / devolución parcial (reusa ámbar) |
| Danger       | `#b3261e` | Cuenta deshabilitada, préstamo sin devolver a fin de semestre |
| Info         | `#166499` | Mensajes informativos (reusa primary)          |

## 3. Escala de grises (neutros)

| Token         | Hex       |
|---------------|-----------|
| gray-50       | `#f7f8fa` | (fondo de página) |
| gray-100      | `#eef1f5` | (fondo de tarjetas alternas) |
| gray-200      | `#dde2ea` | (bordes hairline) |
| gray-400      | `#9aa5b5` | (texto muted / placeholders) |
| gray-600      | `#586274` | (texto secundario) |
| gray-900      | `#151f3f` | (texto primario = navy institucional) |

## 4. Tipografía

- Familia: **Source Sans 3** (Google Fonts). Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`.
- Pesos a cargar: 400 (regular), 600 (semibold), 700 (bold).
- Import (en `index.html` o vía `@fontsource/source-sans-3`):
  `https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap`

Escala tipográfica sugerida:

| Elemento     | Tamaño | Peso |
|--------------|--------|------|
| h1           | 32px   | 700  |
| h2           | 24px   | 600  |
| h3           | 20px   | 600  |
| body         | 16px   | 400  |
| small / meta | 14px   | 400  |

## 5. Reglas de uso del logo (del manual — obligatorias)

- **Área de protección**: mantener espacio libre alrededor del logo; no pegar texto ni elementos.
- **Convivencia con otros logos**: cualquier otro logo va a la DERECHA del de UCN, mismo tamaño
  visual, ambos centrados horizontalmente, separación mínima de `1x`.
- **Aplicaciones indebidas** (prohibido): deformar, inclinar/rotar, cambiar colores, aplicar
  sombras, agregar contornos, cambiar la tipografía del logo.
- En la práctica: el logo institucional va en el header con su espacio de protección y no se toca.

Assets disponibles en el repo (subidos por el usuario):
- Lockup horizontal (sello + wordmark), sello full color.
- SVGs: Escuela de Ingeniería, `LogoICCI` (Ing. Civil en Computación e Informática), `LogoICI`, `LogoITI`.

## 6. Radios y espaciado

- `--radius`: 8px (controles, inputs, botones)
- `--radius-card`: 12px (tarjetas)
- Espaciado base: múltiplos de 4px (4, 8, 12, 16, 24, 32).

---

## 7. CSS custom properties (fuente de verdad — copiar a `:root`)

```css
:root {
  /* Marca institucional */
  --ucn-navy: #151f3f;
  --ucn-blue: #166499;
  --ucn-sky: #7c9ac0;
  --ucn-terracota: #bb6125;
  --ucn-ocre: #a56829;
  --ucn-ambar: #d5a140;

  /* Roles semánticos */
  --color-primary: #166499;
  --color-primary-hover: #12547f;
  --color-primary-active: #0f4468;
  --color-accent: #bb6125;

  /* Funcionales */
  --color-success: #2e7d32;
  --color-warning: #d5a140;
  --color-danger: #b3261e;
  --color-info: #166499;

  /* Neutros */
  --gray-50: #f7f8fa;
  --gray-100: #eef1f5;
  --gray-200: #dde2ea;
  --gray-400: #9aa5b5;
  --gray-600: #586274;
  --gray-900: #151f3f;

  /* Texto */
  --text-primary: #151f3f;
  --text-secondary: #586274;
  --text-muted: #9aa5b5;
  --text-on-primary: #ffffff;

  /* Superficies */
  --surface-page: #f7f8fa;
  --surface-card: #ffffff;
  --border: #dde2ea;

  /* Tipografía */
  --font-sans: "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* Layout */
  --radius: 8px;
  --radius-card: 12px;
}
```

## 8. Mapeo a Tailwind (se implementa en la Fase 4)

En la Fase 4 estos tokens se mapean al theme de Tailwind (según la versión instalada:
Tailwind v4 usa `@theme` en CSS; v3 usa `tailwind.config.js`). La fuente de verdad son
las CSS custom properties de arriba; Tailwind solo las referencia (ej. `bg-[var(--color-primary)]`
o alias en el theme). No duplicar valores hex en la config.