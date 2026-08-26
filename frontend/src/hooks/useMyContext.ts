import { useMyContexts } from '@/api/student';
import type { MyContext } from '@/lib/apiTypes';

export interface MyContextResult {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** El contexto pedido, o null si el curso no está entre los del usuario. */
  context: MyContext | null;
  /** true cuando ya cargó y el curso NO pertenece al usuario (deep-link inválido). */
  notAllowed: boolean;
}

/**
 * Resuelve un contexto por courseId validando que pertenezca al usuario.
 * Necesario para el deep-linking: entrar por URL a un curso ajeno debe rebotar.
 */
export function useMyContext(courseId: string): MyContextResult {
  const contexts = useMyContexts();
  const context = (contexts.data ?? []).find((c) => c.courseId === courseId) ?? null;

  return {
    isLoading: contexts.isLoading,
    isError: contexts.isError,
    error: contexts.error,
    context,
    notAllowed: contexts.isSuccess && context === null,
  };
}
