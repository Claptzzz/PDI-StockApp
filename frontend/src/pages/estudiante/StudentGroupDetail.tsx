import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { KitStatus, LoanStatus, MyGroupDetail } from '@/lib/apiTypes';
import { formatPeriod } from '@/lib/format';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Td, Th } from '@/components/ui/Table';
import { PhotoModal } from '@/components/ui/PhotoModal';
import { KitVerificationCard } from './KitVerificationCard';

const KIT_TONE: Record<KitStatus, BadgeTone> = { ASSIGNED: 'ambar', RETURNED: 'success' };
const kitLabel: Record<KitStatus, string> = { ASSIGNED: 'Asignado', RETURNED: 'Devuelto' };
const LOAN_TONE: Record<LoanStatus, BadgeTone> = {
  PENDIENTE: 'ambar',
  PARCIAL: 'blue',
  DEVUELTO: 'success',
};

/** Detalle de grupo en SOLO LECTURA para el alumno (vista 4d). */
export function StudentGroupDetail({ data }: { data: MyGroupDetail }) {
  const queryClient = useQueryClient();
  // Kit que dispara el aviso prominente: se abre su modal de verificación.
  const [autoVerifyKitId, setAutoVerifyKitId] = useState<string | null>(null);
  /** Id del préstamo cuya foto se está viendo en el visor. */
  const [photoLoanId, setPhotoLoanId] = useState<string | null>(null);
  const photoLoan = data.loans.find((l) => l.id === photoLoanId) ?? null;

  const kitPending = data.kits.reduce(
    (sum, k) => sum + k.items.reduce((s, it) => s + it.pending, 0),
    0,
  );
  const loanPending = data.loans.reduce((sum, l) => sum + l.pending, 0);

  // Solo los kits vigentes exigen acción; un kit devuelto ya no.
  const activeKits = data.kits.filter((k) => k.status === 'ASSIGNED');
  const unverified = activeKits.filter((k) => !k.isVerified);
  const toAccept = activeKits.filter((k) => k.isVerified && !k.hasAccepted);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-5">
        <h2 className="text-xl font-bold text-text-primary">{data.groupName}</h2>
        <p className="mt-1 text-text-secondary">
          {data.course.name} · {formatPeriod(data.course.year, data.course.semester)}
        </p>
      </div>

      {unverified.length > 0 && (
        <div className="rounded-[var(--radius-card)] border-2 border-warning bg-warning/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-bold text-ocre">Debes verificar tu kit</p>
              <p className="mt-1 text-sm text-text-secondary">
                Revisa ítem por ítem que el kit {unverified.map((k) => k.code).join(', ')} venga
                completo. Basta con que lo haga un integrante del grupo.
              </p>
            </div>
            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setAutoVerifyKitId(unverified[0].id)}
            >
              Verificar ahora
            </Button>
          </div>
        </div>
      )}

      {unverified.length === 0 && toAccept.length > 0 && (
        <div className="rounded-[var(--radius-card)] border-2 border-primary bg-primary/5 p-4">
          <p className="text-base font-bold text-primary">Falta que aceptes las condiciones</p>
          <p className="mt-1 text-sm text-text-secondary">
            El kit ya fue verificado. Cada integrante debe aceptar las condiciones de préstamo por
            su cuenta; revisa el bloque «Condiciones de préstamo» más abajo.
          </p>
        </div>
      )}

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

      <section>
        <h3 className="mb-3 text-lg font-semibold text-text-primary">Kit inicial</h3>
        {data.kits.length === 0 ? (
          <p className="text-sm text-text-muted">Aún no tienes un kit asignado.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Verificación + condiciones, por kit. */}
            {data.kits.map((kit) => (
              <KitVerificationCard
                key={`verify-${kit.id}`}
                kitId={kit.id}
                verifyRequested={autoVerifyKitId === kit.id}
                onVerifyClose={() => setAutoVerifyKitId(null)}
              />
            ))}

            {data.kits.map((kit) => (
              <div
                key={kit.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-text-primary">
                    Kit {kit.code} · devoluciones
                  </span>
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
                  <button
                    type="button"
                    onClick={() => setPhotoLoanId(loan.id)}
                    aria-label={`Ver foto de ${loan.componentName}`}
                    className="shrink-0 rounded transition-opacity hover:opacity-80"
                  >
                    <img
                      src={loan.signedUrl}
                      alt="evidencia"
                      className="h-12 w-12 rounded object-cover"
                    />
                  </button>
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

      <PhotoModal
        open={Boolean(photoLoan)}
        onClose={() => setPhotoLoanId(null)}
        url={photoLoan?.signedUrl ?? null}
        title={photoLoan?.componentName ?? ''}
        subtitle={photoLoan?.note ?? undefined}
        // El detalle del grupo trae las signedUrl: invalidarlo las renueva.
        onReload={() => void queryClient.invalidateQueries({ queryKey: ['me', 'group'] })}
      />
    </div>
  );
}
