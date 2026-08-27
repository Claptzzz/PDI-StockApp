import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCourseOverview } from '@/api/courseOverview';
import { useGroups } from '@/api/groups';
import { useGroupSearch } from '@/hooks/useGroupSearch';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { CourseOverviewGroup, CourseOverviewTotals } from '@/lib/apiTypes';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SearchBar } from '@/components/ui/SearchBar';
import { Table, Td, Th } from '@/components/ui/Table';
import { Loading, ErrorState } from '@/components/ui/States';

type Filter = 'all' | 'unverified' | 'unsigned' | 'returns' | 'discrepancies';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'unverified', label: 'Falta verificar' },
  { id: 'unsigned', label: 'Faltan firmas' },
  { id: 'returns', label: 'Con devoluciones pendientes' },
  { id: 'discrepancies', label: 'Con discrepancias' },
];

const MATCHES: Record<Filter, (g: CourseOverviewGroup) => boolean> = {
  all: () => true,
  unverified: (g) => g.kit !== null && !g.kit.isVerified,
  unsigned: (g) => g.acceptance.pendingMembers.length > 0,
  returns: (g) => !g.returns.allReturned,
  discrepancies: (g) => g.kit?.hasDiscrepancies === true,
};

interface CourseOverviewSectionProps {
  courseId: string;
  /** Ruta al detalle de un grupo; difiere entre profesor y ayudante. */
  groupHref: (groupId: string) => string;
}

/**
 * Resumen agregado del curso: totales + estado por grupo, para revisar todo de una
 * vez en lugar de entrar grupo por grupo. La comparten profesor y ayudante.
 */
export function CourseOverviewSection({ courseId, groupHref }: CourseOverviewSectionProps) {
  const overview = useCourseOverview(courseId);
  // Se reutiliza el hook de búsqueda del listado de grupos: necesita los integrantes,
  // que el resumen no trae completos (solo los que faltan por firmar). En la práctica
  // sale de la caché de react-query porque la pestaña «Grupos» ya lo pidió.
  const groupsQuery = useGroups(courseId);
  const search = useGroupSearch(groupsQuery.data);

  const [filter, setFilter] = useState<Filter>('all');
  const [pendingFor, setPendingFor] = useState<CourseOverviewGroup | null>(null);

  const matchedIds = useMemo(
    () => (search.active ? new Set(search.matches.map((m) => m.group.id)) : null),
    [search.active, search.matches],
  );

  const allGroups = useMemo(() => overview.data?.groups ?? [], [overview.data]);

  const rows = useMemo(
    () =>
      allGroups
        .filter(MATCHES[filter])
        .filter((g) => (matchedIds ? matchedIds.has(g.groupId) : true)),
    [allGroups, filter, matchedIds],
  );

  if (overview.isLoading) return <Loading />;
  if (overview.isError) return <ErrorState message={getApiErrorMessage(overview.error)} />;
  if (!overview.data) return null;

  const { totals } = overview.data;
  const allClear =
    totals.kitsPendingVerification === 0 &&
    totals.acceptancesPending === 0 &&
    totals.groupsWithPending === 0 &&
    totals.discrepancies === 0;

  return (
    <div className="flex flex-col gap-5">
      <TotalsGrid totals={totals} />

      {allClear && (
        <p className="rounded-[var(--radius-card)] border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          Todo al día en este curso ✅ — kits verificados, condiciones firmadas y sin
          devoluciones pendientes.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <SearchBar
          value={search.query}
          onValueChange={search.setQuery}
          placeholder="Buscar grupo por nombre o integrante…"
          aria-label="Buscar grupo"
        />

        <div className="flex min-w-0 flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count = allGroups.filter(MATCHES[f.id]).length;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.id)}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-primary bg-primary text-text-on-primary'
                    : 'border-border bg-surface-card text-text-secondary hover:border-primary'
                }`}
              >
                <span className="truncate">{f.label}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 text-[10px] ${
                    active ? 'bg-white/25' : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-text-secondary">
          {rows.length} de {totals.groups} grupo(s)
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-border bg-surface-card p-8 text-center text-sm text-text-muted">
          Ningún grupo coincide con el filtro.
        </p>
      ) : (
        <GroupRows rows={rows} groupHref={groupHref} onShowPending={setPendingFor} />
      )}

      <PendingSignersModal group={pendingFor} onClose={() => setPendingFor(null)} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sección A — totales
// ----------------------------------------------------------------------------

function TotalsGrid({ totals }: { totals: CourseOverviewTotals }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Grupos" value={totals.groups} />
      <StatCard label="Estudiantes" value={totals.students} />
      <StatCard
        label="Kits verificados"
        value={`${totals.kitsVerified}/${totals.kitsAssigned}`}
        tone={totals.kitsPendingVerification === 0 ? 'success' : 'warning'}
      />
      <StatCard
        label="Firmas"
        value={`${totals.acceptancesSigned}/${totals.acceptancesTotal}`}
        tone={totals.acceptancesPending === 0 ? 'success' : 'warning'}
      />
      <StatCard
        label="Todo devuelto"
        value={`${totals.groupsAllReturned}/${totals.groups}`}
        tone={totals.groupsWithPending === 0 ? 'success' : 'warning'}
      />
      <StatCard
        label="Discrepancias"
        value={totals.discrepancies}
        tone={totals.discrepancies === 0 ? 'success' : 'danger'}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-ocre'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-text-primary';
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface-card p-4">
      <div className={`text-2xl font-bold sm:text-3xl ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sección B — grupos
// ----------------------------------------------------------------------------

function KitBadge({ kit }: { kit: CourseOverviewGroup['kit'] }) {
  if (!kit) return <span className="text-xs text-text-muted">Sin kit</span>;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="font-mono text-xs text-text-secondary">{kit.code}</span>
      <Badge tone={kit.isVerified ? 'success' : 'ambar'}>
        {kit.isVerified ? 'Verificado' : 'Sin verificar'}
      </Badge>
      {kit.hasDiscrepancies && <Badge tone="danger">⚑ Discrepancias</Badge>}
    </div>
  );
}

/** Contador de firmas: al pulsarlo abre la lista de quiénes faltan. */
function SignaturesCell({
  group,
  onShowPending,
}: {
  group: CourseOverviewGroup;
  onShowPending: (g: CourseOverviewGroup) => void;
}) {
  const { signed, total, pendingMembers } = group.acceptance;
  if (total === 0) return <span className="text-xs text-text-muted">—</span>;

  if (pendingMembers.length === 0) {
    return (
      <Badge tone="success">
        {signed}/{total}
      </Badge>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onShowPending(group)}
      title="Ver quiénes faltan por firmar"
      className="inline-flex items-center gap-1 rounded-full bg-ambar/20 px-2.5 py-0.5 text-xs font-semibold text-ocre transition-opacity hover:opacity-80"
    >
      {signed}/{total} <span aria-hidden>›</span>
    </button>
  );
}

function ReturnsCell({ returns }: { returns: CourseOverviewGroup['returns'] }) {
  if (returns.allReturned) {
    return <span className="text-xs font-semibold text-success">Todo devuelto</span>;
  }
  const parts = [
    returns.pendingKitUnits > 0 && `${returns.pendingKitUnits} de kit`,
    returns.pendingLoanUnits > 0 && `${returns.pendingLoanUnits} de préstamos`,
  ].filter(Boolean);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-warning">{parts.join(' · ')}</span>
      {returns.hasReturnNotes && <Badge tone="ambar">⚑ Notas</Badge>}
    </div>
  );
}

interface GroupRowsProps {
  rows: CourseOverviewGroup[];
  groupHref: (groupId: string) => string;
  onShowPending: (g: CourseOverviewGroup) => void;
}

function GroupRows({ rows, groupHref, onShowPending }: GroupRowsProps) {
  return (
    <>
      {/* Móvil: tarjetas apiladas con los mismos datos. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((g) => (
          <div
            key={g.groupId}
            className={`min-w-0 rounded-[var(--radius-card)] border p-3 ${
              g.needsAttention ? 'border-warning bg-warning/5' : 'border-border bg-surface-card'
            }`}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-semibold text-text-primary">{g.groupName}</p>
                <p className="text-xs text-text-secondary">{g.memberCount} integrante(s)</p>
              </div>
              <Link to={groupHref(g.groupId)} className="shrink-0">
                <Button size="sm" variant="secondary">
                  Abrir
                </Button>
              </Link>
            </div>

            <dl className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-sm">
              <Field label="Kit">
                <KitBadge kit={g.kit} />
              </Field>
              <Field label="Firmas">
                <SignaturesCell group={g} onShowPending={onShowPending} />
              </Field>
              <Field label="Devoluciones">
                <ReturnsCell returns={g.returns} />
              </Field>
            </dl>
          </div>
        ))}
      </div>

      {/* Desktop: tabla. */}
      <div className="hidden sm:block">
        <Table>
          <thead>
            <tr>
              <Th>Grupo</Th>
              <Th>Integrantes</Th>
              <Th>Kit</Th>
              <Th>Firmas</Th>
              <Th>Devoluciones</Th>
              <Th className="text-right">Acción</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.groupId} className={g.needsAttention ? 'bg-warning/5' : undefined}>
                <Td className="font-semibold">{g.groupName}</Td>
                <Td>{g.memberCount}</Td>
                <Td>
                  <KitBadge kit={g.kit} />
                </Td>
                <Td>
                  <SignaturesCell group={g} onShowPending={onShowPending} />
                </Td>
                <Td>
                  <ReturnsCell returns={g.returns} />
                </Td>
                <Td className="text-right">
                  <Link to={groupHref(g.groupId)}>
                    <Button size="sm" variant="secondary">
                      Abrir grupo
                    </Button>
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Quiénes faltan por firmar
// ----------------------------------------------------------------------------

function PendingSignersModal({
  group,
  onClose,
}: {
  group: CourseOverviewGroup | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(group)}
      onClose={onClose}
      title="Faltan por firmar"
      footer={<Button onClick={onClose}>Cerrar</Button>}
    >
      {group && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{group.groupName}</span> ·{' '}
            {group.acceptance.signed} de {group.acceptance.total} han aceptado las condiciones
            {group.kit?.verifiedAt &&
              ` (kit verificado el ${formatDateTime(group.kit.verifiedAt)})`}
            .
          </p>
          <ul className="flex flex-col gap-2">
            {group.acceptance.pendingMembers.map((m) => (
              <li
                key={m.id}
                className="min-w-0 rounded-[var(--radius)] border border-border p-3 text-sm"
              >
                <p className="break-words font-semibold text-text-primary">{m.name}</p>
                <a
                  href={`mailto:${m.email}`}
                  className="break-words text-xs text-primary hover:underline"
                >
                  {m.email}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
