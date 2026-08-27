import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CourseOverview } from '@/lib/apiTypes';

/** Resumen agregado del curso (una sola llamada para todos los grupos). */
export function useCourseOverview(courseId: string) {
  return useQuery({
    queryKey: ['courses', courseId, 'overview'],
    enabled: Boolean(courseId),
    queryFn: async () =>
      (await api.get<CourseOverview>(`/courses/${courseId}/overview`)).data,
  });
}
