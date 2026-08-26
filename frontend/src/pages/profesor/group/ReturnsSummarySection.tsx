import { useReturnsSummary } from '@/api/loans';
import { getApiErrorMessage } from '@/lib/errors';
import { Badge } from '@/components/ui/Badge';
import { ReturnTimeline, ReturnNotesFlag } from '@/components/ui/ReturnTimeline';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

export function ReturnsSummarySection({
  courseId,
  groupId,
}: {
  courseId: string;
  groupId: string;
}) {
  const summary = useReturnsSummary(courseId, groupId, true);

  if (summary.isLoading) return <Loading />;
  if (summary.isError) return <ErrorState message={getApiErrorMessage(summary.error)} />;
  if (!summary.data) return null;

  const { allReturned, kits, loans } = summary.data;

  if (kits.length === 0 && loans.length === 0) {
    return <EmptyState message="Sin kits ni préstamos que resumir." />;
  }

  const pendingCell = (pending: number) => (
    <span className={pending > 0 ? 'font-semibold text-warning' : 'text-success'}>{pending}</span>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">Estado del grupo:</span>
        <Badge tone={allReturned ? 'success' : 'ambar'}>
          {allReturned ? 'Todo devuelto' : 'Faltan devoluciones'}
        </Badge>
      </div>

      <section>
        <h3 className="mb-2 text-lg font-semibold text-text-primary">Kits</h3>
        {kits.length === 0 ? (
          <p className="text-sm text-text-muted">Sin kits.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {kits.map((kit) => (
              <div
                key={kit.kitId}
                className="rounded-[var(--radius)] border border-border bg-surface-card p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-primary">{kit.code}</span>
                  {kit.hasReturnNotes && <ReturnNotesFlag />}
                  <span className="ml-auto">
                    <Badge tone={kit.allReturned ? 'success' : 'ambar'}>
                      {kit.allReturned ? 'Devuelto' : 'Pendiente'}
                    </Badge>
                  </span>
                </div>

                {/* Tarjetas apiladas (no tabla): la timeline necesita ancho completo en móvil. */}
                <div className="mt-2 flex flex-col gap-2">
                  {kit.items.map((it) => (
                    <div
                      key={it.kitItemId}
                      className="min-w-0 border-t border-border pt-2 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <span className="min-w-0 break-words text-sm font-semibold text-text-primary">
                          {it.componentName}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {it.returnedQuantity}/{it.quantity} devuelto(s) · pendiente{' '}
                          {pendingCell(it.pending)}
                        </span>
                      </div>
                      <ReturnTimeline events={it.returnEvents} className="mt-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-lg font-semibold text-text-primary">Préstamos adicionales</h3>
        {loans.length === 0 ? (
          <p className="text-sm text-text-muted">Sin préstamos.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {loans.map((loan) => (
              <div
                key={loan.loanId}
                className="min-w-0 rounded-[var(--radius)] border border-border bg-surface-card p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="min-w-0 break-words text-sm font-semibold text-text-primary">
                    {loan.componentName}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {loan.returnedQuantity}/{loan.quantity} devuelto(s) · pendiente{' '}
                    {pendingCell(loan.pending)}
                  </span>
                </div>
                {loan.hasReturnNotes && <ReturnNotesFlag className="mt-1.5" />}
                <ReturnTimeline events={loan.returnEvents} className="mt-1.5" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
