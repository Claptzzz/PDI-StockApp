import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MyContext, MyGroupDetail, MyGroupSummary } from '@/lib/apiTypes';

export function useMyContexts(enabled = true) {
  return useQuery({
    queryKey: ['me', 'contexts'],
    enabled,
    queryFn: async () => (await api.get<MyContext[]>('/me/contexts')).data,
  });
}

export function useMyGroups() {
  return useQuery({
    queryKey: ['me', 'groups'],
    queryFn: async () => (await api.get<MyGroupSummary[]>('/me/groups')).data,
  });
}

export function useMyGroup(groupId: string | null) {
  return useQuery({
    queryKey: ['me', 'group', groupId],
    enabled: Boolean(groupId),
    // Las signedUrl de las fotos expiran (~1h): re-consultar al cargar el detalle.
    staleTime: 0,
    queryFn: async () => (await api.get<MyGroupDetail>(`/me/groups/${groupId}`)).data,
  });
}
