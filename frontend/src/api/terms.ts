import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ResolvedTerms, TermsDocumentSummary, TermsVersionRow } from '@/lib/apiTypes';

/**
 * Condiciones vigentes. Con `courseId` devuelve las del documento asignado a ese
 * curso (o el global si no tiene uno).
 * OJO: no confundir con `useTerms` de `@/api/courses`, que son periodos académicos.
 */
export function useLoanTerms(enabled = true, courseId?: string) {
  return useQuery({
    queryKey: ['loan-terms', courseId ?? null],
    enabled,
    // El texto cambia muy rara vez; evita repedirlo al reabrir el modal.
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      (
        await api.get<ResolvedTerms>('/terms', {
          params: courseId ? { courseId } : {},
        })
      ).data,
  });
}

// --- Administración ------------------------------------------------------

const DOCS_KEY = ['terms', 'documents'];

/** Invalida documentos, versiones y el texto vigente que ven los alumnos. */
function useTermsInvalidator() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: DOCS_KEY });
    void qc.invalidateQueries({ queryKey: ['terms', 'versions'] });
    void qc.invalidateQueries({ queryKey: ['loan-terms'] });
    // El curso muestra qué documento usa.
    void qc.invalidateQueries({ queryKey: ['courses'] });
  };
}

export function useTermsDocuments(enabled = true) {
  return useQuery({
    queryKey: DOCS_KEY,
    enabled,
    queryFn: async () => (await api.get<TermsDocumentSummary[]>('/terms/documents')).data,
  });
}

export function useTermsVersions(documentId: string | null) {
  return useQuery({
    queryKey: ['terms', 'versions', documentId],
    enabled: Boolean(documentId),
    queryFn: async () =>
      (await api.get<TermsVersionRow[]>(`/terms/documents/${documentId}/versions`)).data,
  });
}

export function useCreateTermsDocument() {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.post<TermsDocumentSummary>('/terms/documents', { name })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTermsDocument() {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      isDefault?: boolean;
    }) => (await api.patch<TermsDocumentSummary>(`/terms/documents/${id}`, body)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTermsDocument() {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/terms/documents/${id}`)).data,
    onSuccess: invalidate,
  });
}

export interface TermsVersionInput {
  version: string;
  title: string;
  body: string;
  publish?: boolean;
}

export function useCreateTermsVersion(documentId: string) {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async (input: TermsVersionInput) =>
      (await api.post<TermsVersionRow>(`/terms/documents/${documentId}/versions`, input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTermsVersion() {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Partial<TermsVersionInput>) =>
      (await api.patch<TermsVersionRow>(`/terms/versions/${id}`, body)).data,
    onSuccess: invalidate,
  });
}

export function usePublishTermsVersion() {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<TermsVersionRow>(`/terms/versions/${id}/publish`)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTermsVersion() {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/terms/versions/${id}`)).data,
    onSuccess: invalidate,
  });
}

/** Asigna (o desasigna con null) el documento de condiciones de un curso. */
export function useSetCourseTerms() {
  const invalidate = useTermsInvalidator();
  return useMutation({
    mutationFn: async ({
      courseId,
      termsDocumentId,
    }: {
      courseId: string;
      termsDocumentId: string | null;
    }) => (await api.patch(`/courses/${courseId}/terms`, { termsDocumentId })).data,
    onSuccess: invalidate,
  });
}
