import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { KitTemplate } from '@/lib/apiTypes';

export interface TemplateItemInput {
  componentId: string;
  quantity: number;
}

export interface TemplateInput {
  name: string;
  items: TemplateItemInput[];
}

export function useKitTemplates() {
  return useQuery({
    queryKey: ['kit-templates'],
    queryFn: async () => (await api.get<KitTemplate[]>('/kit-templates')).data,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateInput) =>
      (await api.post<KitTemplate>('/kit-templates', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kit-templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TemplateInput> }) =>
      (await api.patch<KitTemplate>(`/kit-templates/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kit-templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/kit-templates/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kit-templates'] }),
  });
}
