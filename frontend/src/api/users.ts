import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UserAccount } from '@/lib/apiTypes';
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
