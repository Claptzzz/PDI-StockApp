import { useEffect, useMemo, useState } from 'react';
import { useLoans, useCreateLoan, useReturnLoan, useDeleteLoan } from '@/api/loans';
import { getApiErrorMessage } from '@/lib/errors';
import type { Component, Loan, LoanStatus } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ComponentCombobox } from '@/components/ui/ComponentCombobox';
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
  const [qty, setQty] = useState<Record<string, string>>({});

  const doReturn = (loan: Loan) => {
    const quantity = Number(qty[loan.id] ?? '1');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > loan.pending) {
      toast.error(`Cantidad inválida (1 a ${loan.pending}).`);
      return;
    }
    returnLoan.mutate(
      { loanId: loan.id, quantity },
      {
        onSuccess: () => {
          toast.success('Devolución registrada.');
          setQty((q) => ({ ...q, [loan.id]: '' }));
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
              {loans.data.map((loan) => (
                <tr key={loan.id}>
                  <Td>
                    {loan.signedUrl ? (
                      <a href={loan.signedUrl} target="_blank" rel="noreferrer">
                        <img
                          src={loan.signedUrl}
                          alt="evidencia"
                          className="h-10 w-10 rounded object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
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
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {loan.pending > 0 && (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={loan.pending}
                            value={qty[loan.id] ?? ''}
                            placeholder={String(loan.pending)}
                            onChange={(e) => setQty((q) => ({ ...q, [loan.id]: e.target.value }))}
                            className="w-16 rounded-[var(--radius)] border border-border px-2 py-1 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => doReturn(loan)}
                            disabled={returnLoan.isPending}
                          >
                            Devolver
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(loan)}>
                        Eliminar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
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
          label="Componente (elige de bodega o escribe libremente)"
          placeholder="Ej: Arduino UNO o 'Cámara externa'"
          value={componentName}
          onChange={(text) => {
            setComponentName(text);
            setComponentId(undefined);
          }}
          onPick={(c: Component) => {
            setComponentName(c.name);
            setComponentId(c.id);
          }}
        />
        {componentId ? (
          <p className="-mt-2 text-xs text-success">
            Vinculado a bodega — se validará el stock disponible.
          </p>
        ) : (
          <p className="-mt-2 text-xs text-text-muted">Texto libre — no se valida stock.</p>
        )}

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
