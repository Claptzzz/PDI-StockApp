import { useState } from 'react';
import { useMyGroups, useMyGroup } from '@/api/student';
import { getApiErrorMessage } from '@/lib/errors';
import { formatPeriod } from '@/lib/format';
import { Select } from '@/components/ui/Select';
import { Loading, ErrorState } from '@/components/ui/States';
import { StudentGroupDetail } from './StudentGroupDetail';

/** Vista de alumno (4d): sus grupos con selector si hay más de uno. */
export function MyGroupsView() {
  const groupsQuery = useMyGroups();
  const [selected, setSelected] = useState<string | null>(null);

  const groups = groupsQuery.data ?? [];
  const effectiveId = selected ?? groups[0]?.groupId ?? null;
  const detail = useMyGroup(effectiveId);

  if (groupsQuery.isLoading) return <Loading />;
  if (groupsQuery.isError) return <ErrorState message={getApiErrorMessage(groupsQuery.error)} />;

  if (groups.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-8 text-center">
        <p className="text-text-secondary">
          Todavía no estás asignado a un grupo. Tu profesor te agregará al inicio del semestre.
        </p>
      </div>
    );
  }

  return (
    <div>
      {groups.length > 1 && (
        <div className="mb-4 w-72">
          <Select
            label="Grupo"
            value={effectiveId ?? ''}
            onChange={(e) => setSelected(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.groupName} · {g.course.name} ({formatPeriod(g.course.year, g.course.semester)})
              </option>
            ))}
          </Select>
        </div>
      )}

      {detail.isLoading ? (
        <Loading />
      ) : detail.isError ? (
        <ErrorState message={getApiErrorMessage(detail.error)} />
      ) : detail.data ? (
        <StudentGroupDetail data={detail.data} />
      ) : null}
    </div>
  );
}
