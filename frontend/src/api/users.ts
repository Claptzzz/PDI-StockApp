import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StudentSearchResult, UserAccount } from '@/lib/apiTypes';
import type { Role } from '@/lib/types';

export interface UsersFilter {
  role?: Role;
  search?: string;
}

export function useUsers(filter: UsersFilter) {
  return useQuery({
    queryKey: ['users', filter],
    queryFn: async () => {
      const { data } = await api.get<UserAccount[]>('/users', { params: filter });
      return data;
    },
  });
}

/** Busca profesores registrados por nombre/correo (para el autocompletado). */
export function useSearchProfessors(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: ['users', 'professor-search', term],
    enabled: term.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<UserAccount[]>('/users', {
        params: { role: 'PROFESSOR', search: term },
      });
      return data;
    },
  });
}

/** Busca alumnos por nombre/correo (para el combobox de ayudantes). */
export function useSearchStudents(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: ['users', 'student-search', term],
    enabled: term.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<StudentSearchResult[]>('/users/students/search', {
        params: { q: term },
      });
      return data;
    },
  });
}

export function useSetUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, roles }: { id: string; roles: Role[] }) => {
      const { data } = await api.patch<UserAccount>(`/users/${id}/roles`, { roles });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data } = await api.patch<UserAccount>(`/users/${id}/active`, { isActive });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
