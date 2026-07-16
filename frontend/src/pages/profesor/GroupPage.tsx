import { Link, useParams } from 'react-router-dom';
import { useGroup } from '@/api/groups';
import { GroupTabs } from './group/GroupTabs';

export function GroupPage() {
  const { courseId = '', groupId = '' } = useParams();
  const group = useGroup(courseId, groupId);

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={`/profesor/cursos/${courseId}`} className="text-sm text-primary hover:underline">
        ← Volver a grupos
      </Link>

      <h1 className="mt-2 text-3xl font-bold text-text-primary">{group.data?.name ?? 'Grupo'}</h1>
      <p className="mt-1 text-text-secondary">{group.data?.membersCount ?? 0} integrante(s)</p>

      <div className="mt-5">
        <GroupTabs courseId={courseId} groupId={groupId} canManageMembers />
      </div>
    </div>
  );
}
