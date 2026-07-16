import { useMyContexts } from '@/api/student';
import { useStudentContextStore } from '@/store/studentContext';
import { getApiErrorMessage } from '@/lib/errors';
import { formatPeriod } from '@/lib/format';
import type { MyContext } from '@/lib/apiTypes';
import { Badge } from '@/components/ui/Badge';
import { Loading, ErrorState } from '@/components/ui/States';
import { MyGroupsView } from './MyGroupsView';
import { StudentContextView } from './StudentContextView';
import { AssistantCourseView } from './AssistantCourseView';

export function StudentPage() {
  const contexts = useMyContexts();

  if (contexts.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Loading />
      </div>
    );
  }
  if (contexts.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState message={getApiErrorMessage(contexts.error)} />
      </div>
    );
  }

  const list = contexts.data ?? [];
  const hasAssistant = list.some((c) => c.hatType === 'ASSISTANT');

  // Sin sombrero de ayudante → vista de alumno (4d).
  if (!hasAssistant) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-text-primary">Mi grupo</h1>
        <p className="mt-1 text-text-secondary">Tu grupo, kit y préstamos.</p>
        <div className="mt-6">
          <MyGroupsView />
        </div>
      </div>
    );
  }

  return <UnifiedDashboard contexts={list} />;
}

function UnifiedDashboard({ contexts }: { contexts: MyContext[] }) {
  const { courseId, setCourseId } = useStudentContextStore();
  const selected = contexts.find((c) => c.courseId === courseId) ?? contexts[0];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-text-primary">Mis cursos</h1>
      <p className="mt-1 text-text-secondary">
        Elige un curso para ver tu grupo u operar como ayudante.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contexts.map((c) => {
          const active = selected.courseId === c.courseId;
          const isAssistant = c.hatType === 'ASSISTANT';
          return (
            <button
              key={c.courseId}
              type="button"
              onClick={() => setCourseId(c.courseId)}
              className={`rounded-[var(--radius-card)] border p-4 text-left transition-colors ${
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface-card hover:border-primary'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-text-primary">{c.courseName}</span>
                <Badge tone={isAssistant ? 'terracota' : 'blue'}>
                  {isAssistant ? 'Ayudante' : 'Alumno'}
                </Badge>
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {formatPeriod(c.year, c.semester)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {selected.hatType === 'ASSISTANT' ? (
          <AssistantCourseView courseId={selected.courseId} courseName={selected.courseName} />
        ) : (
          <StudentContextView courseId={selected.courseId} />
        )}
      </div>
    </div>
  );
}
