import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MyContext, MyGroupDetail, MyGroupSummary, MyKitDetail } from '@/lib/apiTypes';

export interface VerifyKitItemInput {
  kitItemId: string;
  verified: boolean;
  note?: string;
}

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

// --- Verificación de entrega y aceptación de condiciones (Fase 9b) ---

export function useMyKit(kitId: string | null) {
  return useQuery({
    queryKey: ['me', 'kit', kitId],
    enabled: Boolean(kitId),
    queryFn: async () => (await api.get<MyKitDetail>(`/me/kits/${kitId}`)).data,
  });
}

/** Invalida el kit y el detalle del grupo (que trae los flags del aviso). */
function useMyKitInvalidator(kitId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['me', 'kit', kitId] });
    void qc.invalidateQueries({ queryKey: ['me', 'group'] });
  };
}

/** Verificación GRUPAL: se envían TODOS los ítems del kit de una vez. */
export function useVerifyKit(kitId: string) {
  const invalidate = useMyKitInvalidator(kitId);
  return useMutation({
    mutationFn: async (items: VerifyKitItemInput[]) =>
      (await api.post<MyKitDetail>(`/me/kits/${kitId}/verify`, { items })).data,
    onSuccess: invalidate,
  });
}

/** Aceptación INDIVIDUAL de las condiciones vigentes. */
export function useAcceptTerms(kitId: string) {
  const invalidate = useMyKitInvalidator(kitId);
  return useMutation({
    mutationFn: async (termsVersion: string) =>
      (await api.post<MyKitDetail>(`/me/kits/${kitId}/accept`, { termsVersion })).data,
    onSuccess: invalidate,
  });
}
