/**
 * Utilidades de color para etiquetas. El color llega como hex libre desde la API,
 * así que no se puede resolver con clases de Tailwind: se inyecta por `style`.
 */

/** Color por defecto cuando la etiqueta no define uno (azul institucional UCN). */
export const DEFAULT_TAG_COLOR = '#166499';

/** Paleta sugerida en el formulario de etiquetas (tokens UCN + funcionales). */
export const TAG_COLOR_PRESETS = [
  { value: '#151f3f', label: 'Navy' },
  { value: '#166499', label: 'Azul' },
  { value: '#7c9ac0', label: 'Celeste' },
  { value: '#bb6125', label: 'Terracota' },
  { value: '#a56829', label: 'Ocre' },
  { value: '#d5a140', label: 'Ámbar' },
  { value: '#2e7d32', label: 'Verde' },
  { value: '#b3261e', label: 'Rojo' },
] as const;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(value: string): boolean {
  return HEX.test(value.trim());
}

/** Normaliza `#abc` → `#aabbcc`; devuelve el fallback si el hex no es válido. */
export function normalizeHex(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!HEX.test(raw)) return DEFAULT_TAG_COLOR;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}

/** Hex + canal alfa (0–1) en formato #rrggbbaa, soportado por todos los navegadores modernos. */
export function hexWithAlpha(value: string | null | undefined, alpha: number): string {
  const hex = normalizeHex(value);
  const aa = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${aa}`;
}

/** Estilos de un badge/pill de etiqueta: fondo tenue, texto y borde del color. */
export function tagStyles(color: string | null | undefined) {
  return {
    backgroundColor: hexWithAlpha(color, 0.12),
    borderColor: hexWithAlpha(color, 0.35),
    color: normalizeHex(color),
  };
}
