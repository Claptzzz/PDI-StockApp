import { useState } from 'react';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { MembersSection } from './MembersSection';
import { KitsSection } from './KitsSection';
import { LoansSection } from './LoansSection';
import { ReturnsSummarySection } from './ReturnsSummarySection';

type Tab = 'members' | 'kits' | 'loans' | 'summary';

const TABS: TabDef<Tab>[] = [
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
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

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
