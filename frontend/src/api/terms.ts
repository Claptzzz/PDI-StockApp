import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LoanTerms } from '@/lib/apiTypes';

/**
 * Condiciones de préstamo (backend = fuente de verdad).
 * OJO: no confundir con `useTerms` de `@/api/courses`, que son periodos académicos.
 */
export function useLoanTerms(enabled = true) {
  return useQuery({
    queryKey: ['loan-terms'],
    enabled,
    // El texto cambia muy rara vez; evita repedirlo al abrir el modal.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api.get<LoanTerms>('/terms')).data,
  });
}
