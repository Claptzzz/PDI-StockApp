import { Link, useParams } from 'react-router-dom';
import { useGroup } from '@/api/groups';
import { useMyContext } from '@/hooks/useMyContext';
import { getApiErrorMessage } from '@/lib/errors';
import { GroupTabs } from '@/pages/profesor/group/GroupTabs';
import { Loading, ErrorState } from '@/components/ui/States';
import { RedirectWithToast } from '@/components/ui/RedirectWithToast';

/**
 * Nivel 3 del ayudante: un grupo del curso, con las MISMAS pestañas del profesor
 * pero sin gestión de miembros (`canManageMembers={false}`).
 */
export function AssistantGroupPage() {
  const { courseId = '', groupId = '' } = useParams();
  const { context, notAllowed, isLoading, isError, error } = useMyContext(courseId);
  const group = useGroup(courseId, groupId);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={getApiErrorMessage(error)} />;

  // Deep-link a un curso ajeno, o a uno donde no es ayudante: rebota al listado.
  if (notAllowed || context?.hatType !== 'ASSISTANT') {
    return (
      <RedirectWithToast
        to="/estudiante"
        message={notAllowed ? 'No tienes acceso a ese curso.' : 'No eres ayudante de ese curso.'}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to={`/estudiante/cursos/${courseId}`}
        className="text-sm text-primary hover:underline"
      >
        ← Volver a grupos
      </Link>

      <h1 className="mt-2 break-words text-3xl font-bold text-text-primary">
        {group.data?.name ?? 'Grupo'}
      </h1>
      <p className="mt-1 text-text-secondary">
        {context.courseName} · {group.data?.membersCount ?? 0} integrante(s)
      </p>

      <div className="mt-5">
        <GroupTabs courseId={courseId} groupId={groupId} canManageMembers={false} />
      </div>
    </div>
  );
}
