import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Loan, ReturnsSummary } from '@/lib/apiTypes';

const loansKey = (courseId: string, groupId: string) => [
  'courses',
  courseId,
  'groups',
  groupId,
  'loans',
];

export interface CreateLoanInput {
  componentName: string;
  quantity: number;
  componentId?: string;
  note?: string;
  file?: File | null;
}

export function useLoans(courseId: string, groupId: string) {
  return useQuery({
    queryKey: loansKey(courseId, groupId),
    // Las signedUrl expiran (~1h): mantener corto para re-consultar al abrir.
    staleTime: 0,
    queryFn: async () =>
      (await api.get<Loan[]>(`/courses/${courseId}/groups/${groupId}/loans`)).data,
  });
}

export function useCreateLoan(courseId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLoanInput) => {
      const form = new FormData();
      form.append('componentName', input.componentName);
      form.append('quantity', String(input.quantity));
      if (input.componentId) form.append('componentId', input.componentId);
      if (input.note) form.append('note', input.note);
      if (input.file) form.append('file', input.file);
      const { data } = await api.post<Loan>(`/courses/${courseId}/groups/${groupId}/loans`, form, {
        headers: { 'Content-Type': null },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: loansKey(courseId, groupId) }),
  });
}

export interface ReturnLoanInput {
  loanId: string;
  quantity: number;
  /** Observación opcional de quien recibe. */
  note?: string;
}

export function useReturnLoan(courseId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ loanId, quantity, note }: ReturnLoanInput) =>
      (
        await api.patch<Loan>(`/courses/${courseId}/groups/${groupId}/loans/${loanId}/return`, {
          quantity,
          note,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: loansKey(courseId, groupId) });
      qc.invalidateQueries({
        queryKey: ['courses', courseId, 'groups', groupId, 'returns-summary'],
      });
    },
  });
}

export function useDeleteLoan(courseId: string, groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loanId: string) =>
      (await api.delete(`/courses/${courseId}/groups/${groupId}/loans/${loanId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: loansKey(courseId, groupId) }),
  });
}

export function useReturnsSummary(courseId: string, groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['courses', courseId, 'groups', groupId, 'returns-summary'],
    enabled,
    staleTime: 0,
    queryFn: async () =>
      (await api.get<ReturnsSummary>(`/courses/${courseId}/groups/${groupId}/returns-summary`))
        .data,
  });
}
