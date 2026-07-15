import { useState } from 'react';
import { useMyGroups, useMyGroup } from '@/api/student';
import { getApiErrorMessage } from '@/lib/errors';
import type { KitStatus, LoanStatus, MyGroupDetail, MyGroupSummary } from '@/lib/apiTypes';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { Loading, ErrorState } from '@/components/ui/States';

const KIT_TONE: Record<KitStatus, BadgeTone> = { ASSIGNED: 'ambar', RETURNED: 'success' };
const kitLabel: Record<KitStatus, string> = { ASSIGNED: 'Asignado', RETURNED: 'Devuelto' };
const LOAN_TONE: Record<LoanStatus, BadgeTone> = {
  PENDIENTE: 'ambar',
  PARCIAL: 'blue',
  DEVUELTO: 'success',
};

const periodLabel = (c: MyGroupSummary['course']) => `${c.year}/${c.semester === 1 ? '01' : '02'}`;

export function StudentPage() {
  const groupsQuery = useMyGroups();
  const [selected, setSelected] = useState<string | null>(null);

  const groups = groupsQuery.data ?? [];
  const effectiveId = selected ?? groups[0]?.groupId ?? null;
  const detail = useMyGroup(effectiveId);

  if (groupsQuery.isLoading) return <Loading />;
  if (groupsQuery.isError) return <ErrorState message={getApiErrorMessage(groupsQuery.error)} />;

  if (groups.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-text-primary">Mi grupo</h1>
        <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface-card p-8 text-center">
          <p className="text-text-secondary">
            Todavía no estás asignado a un grupo. Tu profesor te agregará al inicio del semestre.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold text-text-primary">Mi grupo</h1>
        {groups.length > 1 && (
          <div className="w-72">
            <Select
              label="Grupo"
              value={effectiveId ?? ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName} · {g.course.name} ({periodLabel(g.course)})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="mt-6">
        {detail.isLoading ? (
          <Loading />
        ) : detail.isError ? (
          <ErrorState message={getApiErrorMessage(detail.error)} />
        ) : detail.data ? (
          <GroupDetail data={detail.data} />
        ) : null}
      </div>
    </div>
  );
}

function GroupDetail({ data }: { data: MyGroupDetail }) {
  const kitPending = data.kits.reduce(
    (sum, k) => sum + k.items.reduce((s, it) => s + it.pending, 0),
    0,
  );
  const loanPending = data.loans.reduce((sum, l) => sum + l.pending, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-5">
        <h2 className="text-xl font-bold text-text-primary">{data.groupName}</h2>
        <p className="mt-1 text-text-secondary">
          {data.course.name} · {periodLabel(data.course)}
        </p>
      </div>

      {/* Estado de devoluciones */}
      {data.allReturned ? (
        <div className="rounded-[var(--radius)] border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          ✓ Todo devuelto. No tienes nada pendiente.
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ocre">
          <span className="font-semibold">Tienes ítems por devolver:</span>{' '}
          {kitPending > 0 && `${kitPending} de kit`}
          {kitPending > 0 && loanPending > 0 && ' · '}
          {loanPending > 0 && `${loanPending} de préstamos`}.
        </div>
      )}

      {/* Integrantes */}
      <section className="rounded-[var(--radius-card)] border border-border bg-surface-card p-5">
        <h3 className="mb-3 text-lg font-semibold text-text-primary">Integrantes</h3>
        <ul className="space-y-1 text-sm">
          {data.members.map((m) => (
            <li key={m.id} className="flex justify-between">
              <span className="font-semibold text-text-primary">{m.name}</span>
              <span className="text-text-secondary">{m.email}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Kits */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-text-primary">Kit inicial</h3>
        {data.kits.length === 0 ? (
          <p className="text-sm text-text-muted">Aún no tienes un kit asignado.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.kits.map((kit) => (
              <div
                key={kit.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-text-primary">Kit {kit.code}</span>
                  <Badge tone={KIT_TONE[kit.status]}>{kitLabel[kit.status]}</Badge>
                </div>
                <Table>
                  <thead>
                    <tr>
                      <Th>Componente</Th>
                      <Th>Cantidad</Th>
                      <Th>Devuelto</Th>
                      <Th>Pendiente</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {kit.items.map((it, idx) => (
                      <tr key={idx}>
                        <Td className="font-semibold">{it.componentName}</Td>
                        <Td>{it.quantity}</Td>
                        <Td>{it.returnedQuantity}</Td>
                        <Td>
                          <span
                            className={
                              it.pending > 0 ? 'font-semibold text-warning' : 'text-success'
                            }
                          >
                            {it.pending}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Préstamos adicionales */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-text-primary">Préstamos adicionales</h3>
        {data.loans.length === 0 ? (
          <p className="text-sm text-text-muted">Sin préstamos adicionales.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.loans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface-card p-3"
              >
                {loan.signedUrl ? (
                  <a href={loan.signedUrl} target="_blank" rel="noreferrer">
                    <img
                      src={loan.signedUrl}
                      alt="evidencia"
                      className="h-12 w-12 rounded object-cover"
                    />
                  </a>
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded bg-gray-100 text-xs text-text-muted">
                    s/f
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold text-text-primary">{loan.componentName}</div>
                  {loan.note && <div className="text-xs text-text-muted">{loan.note}</div>}
                  <div className="text-xs text-text-secondary">
                    Cantidad {loan.quantity} · Pendiente{' '}
                    <span
                      className={loan.pending > 0 ? 'font-semibold text-warning' : 'text-success'}
                    >
                      {loan.pending}
                    </span>
                  </div>
                </div>
                <Badge tone={LOAN_TONE[loan.status]}>{loan.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
