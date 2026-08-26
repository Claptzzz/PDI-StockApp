import { Link, useParams } from 'react-router-dom';
import { useMyGroups, useMyGroup } from '@/api/student';
import { useMyContext } from '@/hooks/useMyContext';
import { getApiErrorMessage } from '@/lib/errors';
import { formatPeriod } from '@/lib/format';
import type { MyContext } from '@/lib/apiTypes';
import { Badge } from '@/components/ui/Badge';
import { Loading, ErrorState } from '@/components/ui/States';
import { RedirectWithToast } from '@/components/ui/RedirectWithToast';
import { AssistantCourseView } from './AssistantCourseView';
import { StudentGroupDetail } from './StudentGroupDetail';

/**
 * Nivel 2 de la navegación de alumno/ayudante. El contenido depende del `hatType`
 * de ESE curso: como ayudante se opera sobre los grupos; como alumno se ve el
 * propio grupo en solo lectura.
 */
export function StudentCourseDetailPage() {
  const { courseId = '' } = useParams();
  const { context, notAllowed, isLoading, isError, error } = useMyContext(courseId);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} />;

  // Deep-link a un curso que no está entre sus contextos: rebota al listado.
  if (notAllowed || !context) {
    return <RedirectWithToast to="/estudiante" message="No tienes acceso a ese curso." />;
  }

  const isAssistant = context.hatType === 'ASSISTANT';

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/estudiante" className="text-sm text-primary hover:underline">
        ← Volver a mis cursos
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold text-text-primary">
            {context.courseName}
          </h1>
          <p className="mt-1 text-text-secondary">
            {formatPeriod(context.year, context.semester)}
          </p>
        </div>
        <Badge tone={isAssistant ? 'terracota' : 'blue'}>
          {isAssistant ? 'Ayudante' : 'Alumno'}
        </Badge>
      </div>

      <div className="mt-6">
        {isAssistant ? (
          <AssistantCourseView courseId={courseId} />
        ) : (
          <StudentCourseGroup context={context} />
        )}
      </div>
    </div>
  );
}

/** Grupo del alumno en este curso (solo lectura). */
function StudentCourseGroup({ context }: { context: MyContext }) {
  const groups = useMyGroups();
  const group = groups.data?.find((g) => g.course.id === context.courseId) ?? null;
  const detail = useMyGroup(group?.groupId ?? null);

  if (groups.isLoading) return <Loading />;
  if (groups.isError) return <ErrorState message={getApiErrorMessage(groups.error)} />;

  if (!group) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-8 text-center">
        <p className="font-semibold text-text-primary">Aún no estás en un grupo</p>
        <p className="mt-1 text-sm text-text-secondary">
          Tu profesor te asignará a un grupo de este curso.
        </p>
      </div>
    );
  }

  if (detail.isLoading) return <Loading />;
  if (detail.isError) return <ErrorState message={getApiErrorMessage(detail.error)} />;
  if (!detail.data) return null;

  return (
    <div>
      <p className="mb-4 text-sm text-text-secondary">
        Tu grupo:{' '}
        <span className="font-semibold text-text-primary">{detail.data.groupName}</span> ·{' '}
        {detail.data.members.length} integrante(s)
      </p>
      <StudentGroupDetail data={detail.data} />
    </div>
  );
}
