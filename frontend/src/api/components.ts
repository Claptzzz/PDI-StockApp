import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Component, ComponentDetail } from '@/lib/apiTypes';

export interface ComponentInput {
  name: string;
  code?: string | null;
  description?: string;
  totalStock: number;
  tagIds?: string[];
}

export interface ComponentFilters {
  search?: string;
  /** Etiquetas seleccionadas; se envían como `tagIds=a,b` (OR entre ellas). */
  tagIds?: string[];
  /** Corta a los primeros N (por nombre asc). Lo usa el desplegable del selector. */
  limit?: number;
  /** Permite no consultar hasta que el desplegable se abre. */
  enabled?: boolean;
}

export function useComponents(filters: ComponentFilters | string = {}) {
  // Se acepta un string por compatibilidad con las llamadas que solo buscan.
  const normalized: ComponentFilters = typeof filters === 'string' ? { search: filters } : filters;
  const search = normalized.search?.trim() ?? '';
  const tagIds = normalized.tagIds ?? [];
  const limit = normalized.limit;

  return useQuery({
    queryKey: ['components', search, tagIds, limit ?? null],
    enabled: normalized.enabled ?? true,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (tagIds.length > 0) params.tagIds = tagIds.join(',');
      if (limit) params.limit = String(limit);
      return (await api.get<Component[]>('/components', { params })).data;
    },
  });
}

export function useComponent(id: string | null) {
  return useQuery({
    queryKey: ['component', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<ComponentDetail>(`/components/${id}`)).data,
  });
}

function useComponentInvalidator() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['components'] });
    void qc.invalidateQueries({ queryKey: ['component'] });
    // El conteo por etiqueta y el stock agrupado dependen de los componentes.
    void qc.invalidateQueries({ queryKey: ['tags'] });
    void qc.invalidateQueries({ queryKey: ['metrics', 'stock'] });
  };
}

export function useCreateComponent() {
  const invalidate = useComponentInvalidator();
  return useMutation({
    mutationFn: async (input: ComponentInput) =>
      (await api.post<Component>('/components', input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateComponent() {
  const invalidate = useComponentInvalidator();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ComponentInput> }) =>
      (await api.patch<Component>(`/components/${id}`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteComponent() {
  const invalidate = useComponentInvalidator();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/components/${id}`)).data,
    onSuccess: invalidate,
  });
}
