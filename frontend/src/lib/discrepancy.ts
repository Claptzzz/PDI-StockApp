import type { DiscrepancyAction } from './apiTypes';

/** Etiqueta legible de cada acción, para el historial del profesor. */
export const ACTION_LABEL: Record<DiscrepancyAction, string> = {
  ACKNOWLEDGED: 'Solo constancia',
  REPLACED: 'Repuesto',
  DEDUCTED: 'Descontado del kit',
  WRITE_OFF: 'Baja de inventario',
};

/** Qué significa la decisión para el alumno, en primera persona. */
export const ACTION_FOR_STUDENT: Record<DiscrepancyAction, (quantity: number) => string> = {
  ACKNOWLEDGED: () => 'se dejó constancia; el kit sigue igual',
  REPLACED: (q) => `se repuso ${q} unidad(es); deberás devolverlas al final`,
  DEDUCTED: (q) => `se descontó ${q} unidad(es) del kit — no deberás devolverlas`,
  WRITE_OFF: (q) => `se dio de baja ${q} unidad(es) del inventario — no deberás devolverlas`,
};
