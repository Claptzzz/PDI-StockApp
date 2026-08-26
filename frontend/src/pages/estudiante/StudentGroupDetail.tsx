import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoanStatus, MyGroupDetail } from '@/lib/apiTypes';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { PhotoModal } from '@/components/ui/PhotoModal';
import { KitVerificationCard } from './KitVerificationCard';

const LOAN_TONE: Record<LoanStatus, BadgeTone> = {
  PENDIENTE: 'ambar',
  PARCIAL: 'blue',
  DEVUELTO: 'success',
};

type Tab = 'kit' | 'loans' | 'members';

/**
 * Detalle del grupo para el ALUMNO, en solo lectura.
 *
 * Orden deliberado: primero lo accionable (verificar el kit, aceptar condiciones,
 * devoluciones pendientes) y después el detalle, repartido en pestañas para no
 * apilar todo en un scroll largo.
 */
export function StudentGroupDetail({ data }: { data: MyGroupDetail }) {
  const queryClient = useQueryClient();
  // Kit cuyo modal de verificación abre el aviso prominente.
  const [autoVerifyKitId, setAutoVerifyKitId] = useState<string | null>(null);
  const [photoLoanId, setPhotoLoanId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('kit');

  const photoLoan = data.loans.find((l) => l.id === photoLoanId) ?? null;

  const kitPending = data.kits.reduce(
    (sum, k) => sum + k.items.reduce((s, it) => s + it.pending, 0),
    0,
  );
  const loanPending = data.loans.reduce((sum, l) => sum + l.pending, 0);

  // Solo los kits vigentes exigen acción; uno devuelto ya no.
  const activeKits = data.kits.filter((k) => k.status === 'ASSIGNED');
  const unverified = activeKits.filter((k) => !k.isVerified);
  const toAccept = activeKits.filter((k) => k.isVerified && !k.hasAccepted);
  const needsAction = unverified.length > 0 || toAccept.length > 0;

  const tabs: TabDef<Tab>[] = [
    { id: 'kit', label: 'Kit', badge: needsAction ? '!' : undefined },
    { id: 'loans', label: `Préstamos (${data.loans.length})` },
    { id: 'members', label: `Integrantes (${data.members.length})` },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* --- Lo accionable, siempre visible sobre las pestañas --- */}
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
              onClick={() => {
                setTab('kit');
                setAutoVerifyKitId(unverified[0].id);
              }}
            >
              Verificar ahora
            </Button>
          </div>
        </div>
      )}

      {unverified.length === 0 && toAccept.length > 0 && (
        <div className="rounded-[var(--radius-card)] border-2 border-primary bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-bold text-primary">Falta que aceptes las condiciones</p>
              <p className="mt-1 text-sm text-text-secondary">
                El kit ya fue verificado. Cada integrante debe aceptar por su cuenta.
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setTab('kit')}
            >
              Ir al kit
            </Button>
          </div>
        </div>
      )}

      {data.allReturned ? (
        <p className="rounded-[var(--radius)] border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
          ✓ Todo devuelto. No tienes nada pendiente.
        </p>
      ) : (
        <p className="rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-ocre">
          <span className="font-semibold">Por devolver:</span>{' '}
          {[kitPending > 0 && `${kitPending} de kit`, loanPending > 0 && `${loanPending} de préstamos`]
            .filter(Boolean)
            .join(' · ')}
          .
        </p>
      )}

      {/* --- El detalle, en pestañas --- */}
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mt-1" />

      {tab === 'kit' && (
        <div className="flex flex-col gap-4">
          {data.kits.length === 0 ? (
            <EmptyCard message="Aún no tienes un kit asignado." />
          ) : (
            data.kits.map((kit) => (
              <div key={kit.id} className="flex flex-col gap-3">
                {/* Verificación + condiciones (ya lista los ítems del kit). */}
                <KitVerificationCard
                  kitId={kit.id}
                  verifyRequested={autoVerifyKitId === kit.id}
                  onVerifyClose={() => setAutoVerifyKitId(null)}
                />
                <KitReturnsCard kit={kit} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'loans' && (
        <div className="flex flex-col gap-2">
          {data.loans.length === 0 ? (
            <EmptyCard message="Sin préstamos adicionales." />
          ) : (
            data.loans.map((loan) => (
              <div
                key={loan.id}
                className="flex min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface-card p-3"
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
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-gray-100 text-xs text-text-muted">
                    s/f
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-text-primary">
                    {loan.componentName}
                  </p>
                  {loan.note && (
                    <p className="break-words text-xs text-text-muted">{loan.note}</p>
                  )}
                  <p className="text-xs text-text-secondary">
                    {loan.returnedQuantity}/{loan.quantity} devuelto(s) · pendiente{' '}
                    <span
                      className={loan.pending > 0 ? 'font-semibold text-warning' : 'text-success'}
                    >
                      {loan.pending}
                    </span>
                  </p>
                </div>
                <Badge tone={LOAN_TONE[loan.status]}>{loan.status}</Badge>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'members' && (
        <ul className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-surface-card p-4 text-sm">
          {data.members.map((m) => (
            <li key={m.id} className="flex flex-wrap justify-between gap-x-4">
              <span className="min-w-0 break-words font-semibold text-text-primary">{m.name}</span>
              <span className="min-w-0 break-words text-text-secondary">{m.email}</span>
            </li>
          ))}
        </ul>
      )}

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

/**
 * Estado de devolución del kit. Solo lista lo PENDIENTE: el inventario completo
 * del kit ya lo muestra `KitVerificationCard` justo encima.
 */
function KitReturnsCard({ kit }: { kit: MyGroupDetail['kits'][number] }) {
  const pending = kit.items.filter((it) => it.pending > 0);
  const totalPending = pending.reduce((s, it) => s + it.pending, 0);

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-4">
      <h4 className="text-sm font-bold text-text-primary">Devoluciones del kit {kit.code}</h4>
      {pending.length === 0 ? (
        <p className="mt-1 text-sm text-success">✓ Todos los ítems fueron devueltos.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-text-secondary">
            Quedan <span className="font-semibold text-warning">{totalPending}</span> unidad(es)
            por devolver en bodega.
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {pending.map((it, idx) => (
              <li key={idx} className="flex flex-wrap justify-between gap-x-4">
                <span className="min-w-0 break-words text-text-primary">{it.componentName}</span>
                <span className="text-text-secondary">
                  {it.returnedQuantity}/{it.quantity} devuelto(s) ·{' '}
                  <span className="font-semibold text-warning">{it.pending} pend.</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <p className="rounded-[var(--radius-card)] border border-border bg-surface-card p-6 text-center text-sm text-text-muted">
      {message}
    </p>
  );
}
