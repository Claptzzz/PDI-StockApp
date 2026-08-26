import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Kit } from '@/lib/apiTypes';

const kitsKey = (courseId: string, groupId: string) => [
  'courses',
  courseId,
  'groups',
  groupId,
  'kits',
];

export interface AssignKitInput {
  code: string;
  templateId?: string;
  items?: { componentId: string; quantity: number }[];
}

export function useGroupKits(courseId: string, groupId: string) {
  return useQuery({
    queryKey: kitsKey(courseId, groupId),
    queryFn: async () => (await api.get<Kit[]>(`/courses/${courseId}/groups/${groupId}/kits`)).data,
  });
}

export function useKit(courseId: string, groupId: string, kitId: string | null) {
  return useQuery({
    queryKey: ['courses', courseId, 'groups', groupId, 'kit', kitId],
    enabled: Boolean(kitId),
    queryFn: async () =>
      (await api.get<Kit>(`/courses/${courseId}/groups/${groupId}/kits/${kitId}`)).data,
  });
}

export function useAssignKit(courseId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignKitInput) =>
      (await api.post<Kit>(`/courses/${courseId}/groups/${groupId}/kits`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: kitsKey(courseId, groupId) }),
  });
}

export function useDeleteKit(courseId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kitId: string) =>
      (await api.delete(`/courses/${courseId}/groups/${groupId}/kits/${kitId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: kitsKey(courseId, groupId) }),
  });
}

export interface ReturnKitItemInput {
  kitItemId: string;
  quantity: number;
  /** Observación opcional de quien recibe. */
  note?: string;
}

export function useReturnKitItem(courseId: string, groupId: string, kitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kitItemId, quantity, note }: ReturnKitItemInput) =>
      (
        await api.patch<Kit>(
          `/courses/${courseId}/groups/${groupId}/kits/${kitId}/items/${kitItemId}/return`,
          { quantity, note },
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kitsKey(courseId, groupId) });
      qc.invalidateQueries({ queryKey: ['courses', courseId, 'groups', groupId, 'kit', kitId] });
      qc.invalidateQueries({
        queryKey: ['courses', courseId, 'groups', groupId, 'returns-summary'],
      });
    },
  });
}
