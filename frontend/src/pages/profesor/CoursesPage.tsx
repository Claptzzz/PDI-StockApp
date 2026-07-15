import { Link } from 'react-router-dom';
import { useCourses, useTerms } from '@/api/courses';
import { usePeriodStore } from '@/store/period';
import { getApiErrorMessage } from '@/lib/errors';
import type { Term } from '@/lib/apiTypes';
import { Select } from '@/components/ui/Select';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

const termLabel = (t: Term) => `${t.year}/${t.semester === 1 ? '01' : '02'}`;
const termValue = (t: Term) => `${t.year}-${t.semester}`;

export function ProfesorCoursesPage() {
  const termsQuery = useTerms();
  const { year, semester, setPeriod } = usePeriodStore();

  const terms = termsQuery.data ?? [];
  const stored = terms.find((t) => t.year === year && t.semester === semester);
  const effective = stored ?? terms[0] ?? null;

  const coursesQuery = useCourses(
    effective ? { year: effective.year, semester: effective.semester } : undefined,
  );

  if (termsQuery.isLoading) return <Loading />;
  if (termsQuery.isError) return <ErrorState message={getApiErrorMessage(termsQuery.error)} />;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Mis cursos</h1>
          <p className="mt-1 text-text-secondary">Cursos donde estás autorizado.</p>
        </div>
        {effective && (
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
                  {termLabel(t)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="mt-6">
        {!effective ? (
          <EmptyState message="Aún no tienes cursos autorizados." />
        ) : coursesQuery.isLoading ? (
          <Loading />
        ) : coursesQuery.isError ? (
          <ErrorState message={getApiErrorMessage(coursesQuery.error)} />
        ) : coursesQuery.data && coursesQuery.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coursesQuery.data.map((course) => (
              <Link
                key={course.id}
                to={`/profesor/cursos/${course.id}`}
                className="rounded-[var(--radius-card)] border border-border bg-surface-card p-5 transition-colors hover:border-primary hover:bg-primary/5"
              >
                <h2 className="text-lg font-semibold text-text-primary">{course.name}</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {course.year}/{course.semester === 1 ? '01' : '02'}
                </p>
                <p className="mt-3 text-sm text-text-muted">{course.groupsCount} grupo(s)</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState message="No hay cursos en este periodo." />
        )}
      </div>
    </div>
  );
}
