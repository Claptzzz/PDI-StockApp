import { useState } from 'react';
import { useGroups, useGroup } from '@/api/groups';
import { getApiErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Table, Td, Th } from '@/components/ui/Table';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';
import { GroupTabs } from '@/pages/profesor/group/GroupTabs';

/**
 * Vista de OPERACIÓN para un ayudante: lista de grupos en SOLO LECTURA (sin crear /
 * renombrar / borrar / importar / gestionar miembros) y, al entrar a un grupo, las
 * mismas acciones de operación de la 4c (kits, préstamos, devoluciones).
 */
export function AssistantCourseView({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  const groups = useGroups(courseId);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const banner = (
    <div className="mb-4 rounded-[var(--radius)] border border-terracota/30 bg-terracota/10 px-4 py-2 text-sm font-semibold text-terracota">
      Estás operando como <span className="uppercase">Ayudante</span> · {courseName}
    </div>
  );

  if (selectedGroupId) {
    return (
      <div>
        {banner}
        <AssistantGroupView
          courseId={courseId}
          groupId={selectedGroupId}
          onBack={() => setSelectedGroupId(null)}
        />
      </div>
    );
  }

  return (
    <div>
      {banner}
      {groups.isLoading ? (
        <Loading />
      ) : groups.isError ? (
        <ErrorState message={getApiErrorMessage(groups.error)} />
      ) : groups.data && groups.data.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Grupo</Th>
              <Th>Integrantes</Th>
              <Th className="text-right">Acción</Th>
            </tr>
          </thead>
          <tbody>
            {groups.data.map((g) => (
              <tr key={g.id}>
                <Td className="font-semibold">{g.name}</Td>
                <Td>{g.membersCount}</Td>
                <Td className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedGroupId(g.id)}>
                    Operar
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState message="Este curso aún no tiene grupos." />
      )}
    </div>
  );
}

function AssistantGroupView({
  courseId,
  groupId,
  onBack,
}: {
  courseId: string;
  groupId: string;
  onBack: () => void;
}) {
  const group = useGroup(courseId, groupId);

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">
        ← Volver a grupos
      </button>
      <h2 className="mt-2 text-2xl font-bold text-text-primary">{group.data?.name ?? 'Grupo'}</h2>
      <p className="mt-1 text-text-secondary">{group.data?.membersCount ?? 0} integrante(s)</p>
      <div className="mt-5">
        <GroupTabs courseId={courseId} groupId={groupId} canManageMembers={false} />
      </div>
    </div>
  );
}
