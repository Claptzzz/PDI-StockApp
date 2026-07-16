import { useState } from 'react';
import { MembersSection } from './MembersSection';
import { KitsSection } from './KitsSection';
import { LoansSection } from './LoansSection';
import { ReturnsSummarySection } from './ReturnsSummarySection';

type Tab = 'members' | 'kits' | 'loans' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'members', label: 'Integrantes' },
  { id: 'kits', label: 'Kits' },
  { id: 'loans', label: 'Préstamos' },
  { id: 'summary', label: 'Resumen' },
];

/**
 * Pestañas de operación de un grupo, compartidas por la vista de profesor (4c) y la
 * de ayudante (6b). `canManageMembers=false` deja Integrantes en solo lectura; las
 * operaciones de kits/préstamos/devoluciones son idénticas en ambos casos.
 */
export function GroupTabs({
  courseId,
  groupId,
  canManageMembers = true,
}: {
  courseId: string;
  groupId: string;
  canManageMembers?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('kits');

  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'members' && (
          <MembersSection courseId={courseId} groupId={groupId} canManage={canManageMembers} />
        )}
        {tab === 'kits' && <KitsSection courseId={courseId} groupId={groupId} />}
        {tab === 'loans' && <LoansSection courseId={courseId} groupId={groupId} />}
        {tab === 'summary' && <ReturnsSummarySection courseId={courseId} groupId={groupId} />}
      </div>
    </div>
  );
}
