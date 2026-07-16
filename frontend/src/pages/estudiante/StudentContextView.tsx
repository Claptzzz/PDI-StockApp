import { useMyGroups, useMyGroup } from '@/api/student';
import { getApiErrorMessage } from '@/lib/errors';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';
import { StudentGroupDetail } from './StudentGroupDetail';

/** Vista de alumno para un curso específico (dentro del dashboard doble sombrero). */
export function StudentContextView({ courseId }: { courseId: string }) {
  const groups = useMyGroups();
  const group = groups.data?.find((g) => g.course.id === courseId) ?? null;
  const detail = useMyGroup(group?.groupId ?? null);

  if (groups.isLoading) return <Loading />;
  if (groups.isError) return <ErrorState message={getApiErrorMessage(groups.error)} />;
  if (!group) return <EmptyState message="No estás asignado a un grupo en este curso." />;

  if (detail.isLoading) return <Loading />;
  if (detail.isError) return <ErrorState message={getApiErrorMessage(detail.error)} />;
  if (!detail.data) return null;

  return <StudentGroupDetail data={detail.data} />;
}
