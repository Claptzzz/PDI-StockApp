import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StudentContextState {
  courseId: string | null;
  setCourseId: (courseId: string) => void;
}

/** Contexto (curso) seleccionado en el dashboard del estudiante/ayudante. */
export const useStudentContextStore = create<StudentContextState>()(
  persist(
    (set) => ({
      courseId: null,
      setCourseId: (courseId) => set({ courseId }),
    }),
    { name: 'pdi-student-context' },
  ),
);
