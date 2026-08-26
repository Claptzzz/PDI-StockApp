import { useEffect, useMemo, useState } from 'react';
import { useLoans, useCreateLoan, useReturnLoan, useDeleteLoan } from '@/api/loans';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { Component, Loan, LoanStatus } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReturnModal } from '@/components/ui/ReturnModal';
import { ReturnTimeline, ReturnNotesFlag } from '@/components/ui/ReturnTimeline';
import { PhotoModal } from '@/components/ui/PhotoModal';
import { ComponentCombobox } from '@/components/ui/ComponentCombobox';
import { TagBadgeList } from '@/components/ui/TagBadge';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

const LOAN_TONE: Record<LoanStatus, BadgeTone> = {
  PENDIENTE: 'ambar',
  PARCIAL: 'blue',
  DEVUELTO: 'success',
};

export function LoansSection({ courseId, groupId }: { courseId: string; groupId: string }) {
  const toast = useToast();
  const loans = useLoans(courseId, groupId);
  const returnLoan = useReturnLoan(courseId, groupId);
  const deleteLoan = useDeleteLoan(courseId, groupId);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Loan | null>(null);
  // Préstamo cuyo modal de devolución está abierto (la nota necesita un textarea).
  const [returning, setReturning] = useState<Loan | null>(null);
  /** Préstamo cuya foto se está viendo en el visor. */
  const [photoLoan, setPhotoLoan] = useState<Loan | null>(null);

  const doReturn = (quantity: number, note: string) => {
    if (!returning) return;
    returnLoan.mutate(
      { loanId: returning.id, quantity, note: note || undefined },
      {
        onSuccess: () => {
          toast.success('Devolución registrada.');
          setReturning(null);
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteLoan.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Préstamo eliminado.');
        setDeleting(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setDeleting(null);
      },
    });
  };

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>Nuevo préstamo</Button>
      </div>

      <div className="mt-4">
        {loans.isLoading ? (
          <Loading />
        ) : loans.isError ? (
          <ErrorState message={getApiErrorMessage(loans.error)} />
        ) : loans.data && loans.data.length > 0 ? (
          <LoanList
            loans={loans.data}
            onReturn={setReturning}
            onDelete={setDeleting}
            onOpenPhoto={setPhotoLoan}
          />
        ) : (
          <EmptyState message="Este grupo aún no tiene préstamos adicionales." />
        )}
      </div>

      {createOpen && (
        <CreateLoanModal
          courseId={courseId}
          groupId={groupId}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {returning && (
        <ReturnModal
          componentName={returning.componentName}
          pending={returning.pending}
          loading={returnLoan.isPending}
          onConfirm={doReturn}
          onClose={() => setReturning(null)}
        />
      )}

      <PhotoModal
        open={Boolean(photoLoan)}
        onClose={() => setPhotoLoan(null)}
        // Se relee de `loans.data`: tras "Recargar" trae la signedUrl fresca.
        url={loans.data?.find((l) => l.id === photoLoan?.id)?.signedUrl ?? null}
        title={photoLoan?.componentName ?? ''}
        subtitle={photoLoan ? `Prestado el ${formatDateTime(photoLoan.loanedAt)}` : undefined}
        onReload={() => void loans.refetch()}
        reloading={loans.isFetching}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar préstamo"
        message={
          deleting ? `¿Eliminar el préstamo de "${deleting.componentName}"? Se borra su foto.` : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleteLoan.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/** Miniatura de la foto de evidencia (o marcador si no hay). Abre el visor en modal. */
function LoanPhoto({
  loan,
  size = 'h-10 w-10',
  onOpen,
}: {
  loan: Loan;
  size?: string;
  onOpen: (loan: Loan) => void;
}) {
  if (!loan.signedUrl) {
    return <span className="text-xs text-text-muted">—</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(loan)}
      aria-label={`Ver foto de ${loan.componentName}`}
      className="shrink-0 rounded transition-opacity hover:opacity-80"
    >
      <img src={loan.signedUrl} alt="evidencia" className={`${size} rounded object-cover`} />
    </button>
  );
}

/** Historial de devoluciones del préstamo, con el flag de observaciones. */
function LoanHistory({ loan }: { loan: Loan }) {
  if (loan.returnEvents.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Historial de devoluciones
        </span>
        {loan.hasReturnNotes && <ReturnNotesFlag />}
      </div>
      <ReturnTimeline events={loan.returnEvents} className="mt-1.5" />
    </div>
  );
}

interface LoanListProps {
  loans: Loan[];
  onReturn: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
  onOpenPhoto: (loan: Loan) => void;
}

/**
 * Tarjetas apiladas en móvil, tabla desde `sm`. La tabla necesita scroll
 * horizontal a 375px y eso arrastraría la timeline fuera de la pantalla.
 */
function LoanList({ loans, onReturn, onDelete, onOpenPhoto }: LoanListProps) {
  const actions = (loan: Loan) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {loan.pending > 0 && (
        <Button size="sm" onClick={() => onReturn(loan)}>
          Devolver
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => onDelete(loan)}>
        Eliminar
      </Button>
    </div>
  );

  return (
    <>
      {/* Móvil */}
      <div className="flex flex-col gap-3 sm:hidden">
        {loans.map((loan) => (
          <div
            key={loan.id}
            className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface-card p-3"
          >
            <div className="flex min-w-0 items-start gap-3">
              <LoanPhoto loan={loan} size="h-12 w-12" onOpen={onOpenPhoto} />
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold text-text-primary">{loan.componentName}</p>
                {loan.note && (
                  <p className="break-words text-xs text-text-muted">{loan.note}</p>
                )}
                <p className="mt-0.5 text-xs text-text-secondary">
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

            {loan.returnEvents.length > 0 && (
              <div className="mt-2 border-t border-border pt-2">
                <LoanHistory loan={loan} />
              </div>
            )}
            <div className="mt-2 border-t border-border pt-2">{actions(loan)}</div>
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block">
        <Table>
          <thead>
            <tr>
              <Th>Foto</Th>
              <Th>Componente</Th>
              <Th>Cant.</Th>
              <Th>Estado</Th>
              <Th>Pend.</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {loans.flatMap((loan) => [
              <tr key={loan.id}>
                <Td>
                  <LoanPhoto loan={loan} onOpen={onOpenPhoto} />
                </Td>
                <Td className="font-semibold">
                  {loan.componentName}
                  {loan.note && (
                    <span className="block text-xs font-normal text-text-muted">{loan.note}</span>
                  )}
                </Td>
                <Td>{loan.quantity}</Td>
                <Td>
                  <Badge tone={LOAN_TONE[loan.status]}>{loan.status}</Badge>
                </Td>
                <Td>
                  <span
                    className={loan.pending > 0 ? 'font-semibold text-warning' : 'text-success'}
                  >
                    {loan.pending}
                  </span>
                </Td>
                <Td className="text-right">{actions(loan)}</Td>
              </tr>,
              // Fila extra con el historial, solo si hay devoluciones registradas.
              loan.returnEvents.length > 0 && (
                <tr key={`${loan.id}-history`}>
                  <Td colSpan={6} className="bg-gray-50">
                    <LoanHistory loan={loan} />
                  </Td>
                </tr>
              ),
            ])}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function CreateLoanModal({
  courseId,
  groupId,
  onClose,
}: {
  courseId: string;
  groupId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const createLoan = useCreateLoan(courseId, groupId);

  const [componentName, setComponentName] = useState('');
  const [componentId, setComponentId] = useState<string | undefined>(undefined);
  /** Componente elegido del catálogo (para mostrar código, etiquetas y stock). */
  const [picked, setPicked] = useState<Component | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const submit = () => {
    setError(null);
    const name = componentName.trim();
    const qty = Number(quantity);
    if (!name) return setError('El nombre del componente es obligatorio.');
    if (!Number.isInteger(qty) || qty < 1) return setError('La cantidad debe ser un entero ≥ 1.');

    createLoan.mutate(
      { componentName: name, quantity: qty, componentId, note: note.trim() || undefined, file },
      {
        onSuccess: () => {
          toast.success('Préstamo registrado.');
          onClose();
        },
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo préstamo adicional"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={createLoan.isPending}>
            {createLoan.isPending ? 'Guardando…' : 'Registrar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ComponentCombobox
          label="Componente (busca por nombre o código, o escribe libremente)"
          placeholder="Ej: Arduino UNO, MCU-UNO o 'Cámara externa'"
          value={componentName}
          onChange={(text) => {
            setComponentName(text);
            // Al editar el texto se rompe el vínculo: vuelve a ser texto libre.
            setComponentId(undefined);
            setPicked(null);
          }}
          onPick={(c: Component) => {
            setComponentName(c.name);
            setComponentId(c.id);
            setPicked(c);
          }}
        />

        {/* Origen del componente: enlazado al catálogo vs texto libre. */}
        <div className="-mt-2 flex min-w-0 flex-wrap items-center gap-2">
          {componentId ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                ✓ del inventario
              </span>
              {picked?.code && (
                <span className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                  {picked.code}
                </span>
              )}
              {picked && <TagBadgeList tags={picked.tags} />}
              <span className="text-xs text-text-secondary">
                Se validará el stock ({picked?.available ?? 0} disp.).
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                externo
              </span>
              <span className="text-xs text-text-secondary">
                Texto libre — no se valida stock.
              </span>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <Input
            label="Cantidad"
            type="number"
            className="w-28"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text-secondary">Foto (opcional)</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-text-secondary file:mr-3 file:min-h-[44px] file:rounded-[var(--radius)] file:border-0 file:bg-primary file:px-4 file:text-sm file:font-semibold file:text-text-on-primary"
          />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="preview"
              className="h-32 w-32 rounded-[var(--radius)] border border-border object-cover"
            />
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
