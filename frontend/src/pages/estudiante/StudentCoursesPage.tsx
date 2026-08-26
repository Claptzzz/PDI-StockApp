import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMyContexts } from '@/api/student';
import { usePeriodStore } from '@/store/period';
import { getApiErrorMessage } from '@/lib/errors';
import { formatPeriod } from '@/lib/format';
import type { MyContext } from '@/lib/apiTypes';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Loading, ErrorState } from '@/components/ui/States';

const termValue = (c: Pick<MyContext, 'year' | 'semester'>) => `${c.year}-${c.semester}`;

/**
 * Nivel 1 de la navegación de alumno/ayudante: sus cursos.
 * Equivale a /profesor/cursos, incluido el selector de periodo (mismo store).
 */
export function StudentCoursesPage() {
  const contextsQuery = useMyContexts();
  const { year, semester, setPeriod } = usePeriodStore();

  const contexts = useMemo(() => contextsQuery.data ?? [], [contextsQuery.data]);

  // Periodos presentes en sus contextos, de más reciente a más antiguo.
  const terms = useMemo(() => {
    const seen = new Map<string, { year: number; semester: number }>();
    for (const c of contexts) seen.set(termValue(c), { year: c.year, semester: c.semester });
    return [...seen.values()].sort((a, b) => b.year - a.year || b.semester - a.semester);
  }, [contexts]);

  const stored = terms.find((t) => t.year === year && t.semester === semester);
  const effective = stored ?? terms[0] ?? null;

  const visible = effective
    ? contexts.filter((c) => c.year === effective.year && c.semester === effective.semester)
    : [];

  if (contextsQuery.isLoading) return <Loading />;
  if (contextsQuery.isError) {
    return <ErrorState message={getApiErrorMessage(contextsQuery.error)} />;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-text-primary">Mis cursos</h1>
          <p className="mt-1 text-text-secondary">
            Elige un curso para ver tu grupo u operar como ayudante.
          </p>
        </div>
        {/* Solo tiene sentido ofrecer el selector si hay más de un periodo. */}
        {effective && terms.length > 1 && (
          <div className="w-40">
            <Select
              label="Periodo"
              value={termValue(effective)}
              onChange={(e) => {
                const [y, s] = e.target.value.split('-').map(Number);
                setPeriod(y, s);
              }}
            >
              {terms.map((t) => (
                <option key={termValue(t)} value={termValue(t)}>
                  {formatPeriod(t.year, t.semester)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="mt-6">
        {contexts.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-8 text-center">
            <p className="font-semibold text-text-primary">Todavía no tienes cursos</p>
            <p className="mt-1 text-sm text-text-secondary">
              Tu profesor te agregará a un grupo al inicio del semestre. Vuelve a revisar más
              adelante.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-8 text-center text-sm text-text-secondary">
            No tienes cursos en este periodo.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <Link
                key={c.courseId}
                to={`/estudiante/cursos/${c.courseId}`}
                className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface-card p-5 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h2 className="min-w-0 break-words text-lg font-semibold text-text-primary">
                    {c.courseName}
                  </h2>
                  <Badge tone={c.hatType === 'ASSISTANT' ? 'terracota' : 'blue'}>
                    {c.hatType === 'ASSISTANT' ? 'Ayudante' : 'Alumno'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {formatPeriod(c.year, c.semester)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
