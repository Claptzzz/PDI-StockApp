import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Group, ImportReport } from '@/lib/apiTypes';

const groupsKey = (courseId: string) => ['courses', courseId, 'groups'];

export function useGroups(courseId: string) {
  return useQuery({
    queryKey: groupsKey(courseId),
    queryFn: async () => (await api.get<Group[]>(`/courses/${courseId}/groups`)).data,
  });
}

export function useGroup(courseId: string, groupId: string) {
  return useQuery({
    queryKey: ['courses', courseId, 'group', groupId],
    queryFn: async () => (await api.get<Group>(`/courses/${courseId}/groups/${groupId}`)).data,
  });
}

export function useCreateGroup(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<Group>(`/courses/${courseId}/groups`, { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: groupsKey(courseId) }),
  });
}

export function useRenameGroup(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, name }: { groupId: string; name: string }) =>
      (await api.patch<Group>(`/courses/${courseId}/groups/${groupId}`, { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: groupsKey(courseId) }),
  });
}

export function useDeleteGroup(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) =>
      (await api.delete(`/courses/${courseId}/groups/${groupId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: groupsKey(courseId) }),
  });
}

export function useAddMember(courseId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post(`/courses/${courseId}/groups/${groupId}/members`, { email })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses', courseId, 'group', groupId] });
      qc.invalidateQueries({ queryKey: groupsKey(courseId) });
    },
  });
}

export function useRemoveMember(courseId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) =>
      (await api.delete(`/courses/${courseId}/groups/${groupId}/members/${studentId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses', courseId, 'group', groupId] });
      qc.invalidateQueries({ queryKey: groupsKey(courseId) });
    },
  });
}

export function useImportGroups(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<ImportReport>(`/courses/${courseId}/groups/import`, form, {
        headers: { 'Content-Type': null },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groupsKey(courseId) }),
  });
}
