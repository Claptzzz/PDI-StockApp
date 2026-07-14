import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Component, ComponentDetail } from '@/lib/apiTypes';

export interface ComponentInput {
  name: string;
  description?: string;
  totalStock: number;
}

export function useComponents(search: string) {
  return useQuery({
    queryKey: ['components', search],
    queryFn: async () =>
      (await api.get<Component[]>('/components', { params: search ? { search } : {} })).data,
  });
}

export function useComponent(id: string | null) {
  return useQuery({
    queryKey: ['component', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<ComponentDetail>(`/components/${id}`)).data,
  });
}

export function useCreateComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ComponentInput) =>
      (await api.post<Component>('/components', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  });
}

export function useUpdateComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ComponentInput> }) =>
      (await api.patch<Component>(`/components/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  });
}

export function useDeleteComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/components/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  });
}
