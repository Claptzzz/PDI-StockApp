import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Valor por defecto y de rescate si lo persistido es inválido. */
export const DEFAULT_THRESHOLD = 5;
export const MAX_THRESHOLD = 999;

/** Accesos rápidos ofrecidos junto al input. */
export const THRESHOLD_PRESETS = [5, 10, 20] as const;

interface MetricsThresholdState {
  /** Umbral de "stock bajo" en /admin/metricas. */
  threshold: number;
  /** Solo listar/graficar lo que está en o bajo el umbral. */
  onlyBelow: boolean;
  setThreshold: (value: number) => void;
  setOnlyBelow: (value: boolean) => void;
}

/** true si `value` es un umbral usable (entero dentro del rango). */
export function isValidThreshold(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_THRESHOLD;
}

/**
 * Preferencias del panel de reposición. Viven en el store (y no en el estado del
 * componente) para que sobrevivan a recargas y a navegar fuera de /admin/metricas.
 */
export const useMetricsThresholdStore = create<MetricsThresholdState>()(
  persist(
    (set) => ({
      threshold: DEFAULT_THRESHOLD,
      onlyBelow: false,
      // Se ignoran valores inválidos: el store nunca queda en un estado que rompa la vista.
      setThreshold: (value) => set(isValidThreshold(value) ? { threshold: value } : {}),
      setOnlyBelow: (onlyBelow) => set({ onlyBelow }),
    }),
    {
      name: 'pdi-metrics-threshold',
      // Un localStorage manipulado a mano no debe dejar el gráfico sin colorear.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MetricsThresholdState>;
        return {
          ...current,
          threshold: isValidThreshold(p.threshold ?? NaN) ? p.threshold! : DEFAULT_THRESHOLD,
          onlyBelow: Boolean(p.onlyBelow),
        };
      },
    },
  ),
);
