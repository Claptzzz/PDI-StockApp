import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PeriodState {
  year: number | null;
  semester: number | null;
  setPeriod: (year: number, semester: number) => void;
}

/** Periodo (año/semestre) seleccionado por el profesor; persiste entre navegaciones. */
export const usePeriodStore = create<PeriodState>()(
  persist(
    (set) => ({
      year: null,
      semester: null,
      setPeriod: (year, semester) => set({ year, semester }),
    }),
    { name: 'pdi-period' },
  ),
);
