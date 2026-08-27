/**
 * Acciones de resolución de una discrepancia. Se guardan como texto en
 * `DiscrepancyResolution.action` (no como enum de Prisma) para poder ampliar el
 * catálogo sin migrar el tipo en Postgres.
 */
export const DISCREPANCY_ACTIONS = [
  /** Solo dejar constancia: el ítem queda revisado, sin cambios. */
  'ACKNOWLEDGED',
  /** Se repone el componente: el ítem vuelve a estar conforme (verified=true). */
  'REPLACED',
  /** No se repone: se reduce la cantidad exigida del kit. */
  'DEDUCTED',
  /** Baja de inventario: reduce el stock total del componente y la cantidad del kit. */
  'WRITE_OFF',
] as const;

export type DiscrepancyAction = (typeof DISCREPANCY_ACTIONS)[number];

/** Un ítem tiene discrepancia si el alumno no lo marcó conforme o dejó una nota. */
export function itemHasDiscrepancy(item: {
  verified: boolean;
  verificationNote: string | null;
}): boolean {
  return !item.verified || item.verificationNote !== null;
}

/**
 * Criterio de "resuelto": basta con UNA resolución registrada.
 *
 * Se eligió el criterio simple (y no "la suma de cantidades cubre la discrepancia")
 * porque la discrepancia no siempre tiene una cantidad medible: un ítem puede estar
 * marcado como no recibido sin que se sepa cuántas unidades faltaron, y acciones
 * como ACKNOWLEDGED no consumen unidades. Aun así se admiten varias resoluciones
 * sobre el mismo ítem (reponer 1 y descontar 1) y el historial queda completo.
 */
export function itemIsResolved(item: {
  verified: boolean;
  verificationNote: string | null;
  resolutions: unknown[];
}): boolean {
  return !itemHasDiscrepancy(item) || item.resolutions.length > 0;
}
