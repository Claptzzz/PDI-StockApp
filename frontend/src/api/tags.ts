import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tag } from '@/lib/apiTypes';

export interface TagInput {
  name: string;
  color?: string | null;
}

export function useTags(enabled = true) {
  return useQuery({
    queryKey: ['tags'],
    enabled,
    queryFn: async () => (await api.get<Tag[]>('/tags')).data,
  });
}

/** Invalida etiquetas + todo lo que las embebe (componentes y métricas de stock). */
function useTagInvalidator() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['tags'] });
    void qc.invalidateQueries({ queryKey: ['components'] });
    void qc.invalidateQueries({ queryKey: ['component'] });
    void qc.invalidateQueries({ queryKey: ['metrics', 'stock'] });
  };
}

export function useCreateTag() {
  const invalidate = useTagInvalidator();
  return useMutation({
    mutationFn: async (input: TagInput) => (await api.post<Tag>('/tags', input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTag() {
  const invalidate = useTagInvalidator();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TagInput }) =>
      (await api.patch<Tag>(`/tags/${id}`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTag() {
  const invalidate = useTagInvalidator();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete<{ deleted: boolean; detachedComponents: number }>(`/tags/${id}`)).data,
    onSuccess: invalidate,
  });
}
