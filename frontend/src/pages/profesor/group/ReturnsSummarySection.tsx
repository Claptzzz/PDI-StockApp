import { useReturnsSummary } from '@/api/loans';
import { getApiErrorMessage } from '@/lib/errors';
import { Badge } from '@/components/ui/Badge';
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
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">{kit.code}</span>
                  <Badge tone={kit.allReturned ? 'success' : 'ambar'}>
                    {kit.allReturned ? 'Devuelto' : 'Pendiente'}
                  </Badge>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-secondary">
                      <th className="py-1">Componente</th>
                      <th className="py-1">Prestado</th>
                      <th className="py-1">Devuelto</th>
                      <th className="py-1">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kit.items.map((it) => (
                      <tr key={it.kitItemId} className="border-t border-border">
                        <td className="py-1">{it.componentName}</td>
                        <td className="py-1">{it.quantity}</td>
                        <td className="py-1">{it.returnedQuantity}</td>
                        <td className="py-1">{pendingCell(it.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
          <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-text-secondary">
                  <th className="px-3 py-2">Componente</th>
                  <th className="px-3 py-2">Prestado</th>
                  <th className="px-3 py-2">Devuelto</th>
                  <th className="px-3 py-2">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.loanId} className="border-t border-border">
                    <td className="px-3 py-2">{loan.componentName}</td>
                    <td className="px-3 py-2">{loan.quantity}</td>
                    <td className="px-3 py-2">{loan.returnedQuantity}</td>
                    <td className="px-3 py-2">{pendingCell(loan.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
