import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGroup } from '@/api/groups';
import { MembersSection } from './group/MembersSection';
import { KitsSection } from './group/KitsSection';
import { LoansSection } from './group/LoansSection';
import { ReturnsSummarySection } from './group/ReturnsSummarySection';

type Tab = 'members' | 'kits' | 'loans' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'members', label: 'Integrantes' },
  { id: 'kits', label: 'Kits' },
  { id: 'loans', label: 'Préstamos' },
  { id: 'summary', label: 'Resumen' },
];

export function GroupPage() {
  const { courseId = '', groupId = '' } = useParams();
  const group = useGroup(courseId, groupId);
  const [tab, setTab] = useState<Tab>('members');

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={`/profesor/cursos/${courseId}`} className="text-sm text-primary hover:underline">
        ← Volver a grupos
      </Link>

      <h1 className="mt-2 text-3xl font-bold text-text-primary">{group.data?.name ?? 'Grupo'}</h1>
      <p className="mt-1 text-text-secondary">{group.data?.membersCount ?? 0} integrante(s)</p>

      <div className="mt-5 flex gap-1 border-b border-border">
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
        {tab === 'members' && <MembersSection courseId={courseId} groupId={groupId} />}
        {tab === 'kits' && <KitsSection courseId={courseId} groupId={groupId} />}
        {tab === 'loans' && <LoansSection courseId={courseId} groupId={groupId} />}
        {tab === 'summary' && <ReturnsSummarySection courseId={courseId} groupId={groupId} />}
      </div>
    </div>
  );
}
