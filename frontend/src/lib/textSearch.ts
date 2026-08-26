/**
 * Normaliza para búsqueda: minúsculas y sin acentos, de modo que "Muñoz" coincida
 * con "munoz" y "José" con "jose". NFD separa el diacrítico del carácter base y el
 * rango ̀-ͯ los elimina.
 */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** true si `haystack` contiene `needle`, ambos normalizados. */
export function matchesSearch(haystack: string, normalizedNeedle: string): boolean {
  return normalizeForSearch(haystack).includes(normalizedNeedle);
}
