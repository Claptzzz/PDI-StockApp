import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Course, CourseAssistant, CourseProfessor, Term } from '@/lib/apiTypes';

export interface CourseInput {
  name: string;
  year: number;
  semester: number;
}

export function useCourses(params?: { year?: number; semester?: number }) {
  return useQuery({
    queryKey: ['courses', params ?? {}],
    queryFn: async () => (await api.get<Course[]>('/courses', { params })).data,
  });
}

export function useTerms() {
  return useQuery({
    queryKey: ['courses', 'terms'],
    queryFn: async () => (await api.get<Term[]>('/courses/terms')).data,
  });
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => (await api.get<Course>(`/courses/${courseId}`)).data,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CourseInput) => (await api.post<Course>('/courses', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CourseInput> }) =>
      (await api.patch<Course>(`/courses/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/courses/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

// --- Profesores del curso ---

export function useCourseProfessors(courseId: string | null) {
  return useQuery({
    queryKey: ['course-professors', courseId],
    enabled: Boolean(courseId),
    queryFn: async () => (await api.get<CourseProfessor[]>(`/courses/${courseId}/professors`)).data,
  });
}

export function useAddProfessor(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post(`/courses/${courseId}/professors`, { email })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-professors', courseId] }),
  });
}

export function useSetProfessorAuthorized(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ professorId, authorized }: { professorId: string; authorized: boolean }) =>
      (await api.patch(`/courses/${courseId}/professors/${professorId}`, { authorized })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-professors', courseId] }),
  });
}

export function useRemoveProfessor(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (professorId: string) =>
      (await api.delete(`/courses/${courseId}/professors/${professorId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-professors', courseId] }),
  });
}

// --- Ayudantes del curso ---

export function useCourseAssistants(courseId: string) {
  return useQuery({
    queryKey: ['course-assistants', courseId],
    queryFn: async () => (await api.get<CourseAssistant[]>(`/courses/${courseId}/assistants`)).data,
  });
}

export function useAddAssistant(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post(`/courses/${courseId}/assistants`, { email })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-assistants', courseId] }),
  });
}

export function useSetAssistantActive(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assistantId, active }: { assistantId: string; active: boolean }) =>
      (await api.patch(`/courses/${courseId}/assistants/${assistantId}`, { active })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-assistants', courseId] }),
  });
}

export function useRemoveAssistant(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assistantId: string) =>
      (await api.delete(`/courses/${courseId}/assistants/${assistantId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-assistants', courseId] }),
  });
}
