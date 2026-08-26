import { useState } from 'react';
import axios from 'axios';
import {
  useGroupKits,
  useKit,
  useAssignKit,
  useDeleteKit,
  useReturnKitItem,
  type AssignKitInput,
} from '@/api/kits';
import { useKitTemplates } from '@/api/templates';
import { useComponents } from '@/api/components';
import { getApiErrorMessage } from '@/lib/errors';
import type { Kit, KitItem, KitStatus, Shortage } from '@/lib/apiTypes';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/store/toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReturnModal } from '@/components/ui/ReturnModal';
import { ReturnTimeline, ReturnNotesFlag } from '@/components/ui/ReturnTimeline';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

const KIT_TONE: Record<KitStatus, BadgeTone> = { ASSIGNED: 'ambar', RETURNED: 'success' };
const kitLabel: Record<KitStatus, string> = { ASSIGNED: 'Asignado', RETURNED: 'Devuelto' };

/** Estado de la verificación de entrega + alerta de discrepancias. */
function VerificationBadge({ kit }: { kit: Kit }) {
  if (!kit.isVerified) {
    return <Badge tone="gray">Sin verificar</Badge>;
  }
  return (
    <>
      <Badge tone="success">Verificado</Badge>
      {kit.hasDiscrepancies && <Badge tone="danger">Con discrepancias</Badge>}
    </>
  );
}

function extractShortages(err: unknown): Shortage[] | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { shortages?: Shortage[] } | undefined;
    if (Array.isArray(data?.shortages)) return data.shortages;
  }
  return null;
}

export function KitsSection({ courseId, groupId }: { courseId: string; groupId: string }) {
  const toast = useToast();
  const kits = useGroupKits(courseId, groupId);
  const deleteKit = useDeleteKit(courseId, groupId);

  const [assignOpen, setAssignOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Kit | null>(null);

  const confirmDelete = () => {
    if (!deleting) return;
    deleteKit.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Kit eliminado.');
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
        <Button onClick={() => setAssignOpen(true)}>Asignar kit</Button>
      </div>

      <div className="mt-4">
        {kits.isLoading ? (
          <Loading />
        ) : kits.isError ? (
          <ErrorState message={getApiErrorMessage(kits.error)} />
        ) : kits.data && kits.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Estado</Th>
                <Th>Verificación</Th>
                <Th>Condiciones</Th>
                <Th>Ítems</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {kits.data.map((kit) => (
                <tr key={kit.id} className={kit.hasDiscrepancies ? 'bg-danger/5' : undefined}>
                  <Td className="font-semibold">{kit.code}</Td>
                  <Td>
                    <Badge tone={KIT_TONE[kit.status]}>{kitLabel[kit.status]}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <VerificationBadge kit={kit} />
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={kit.allAccepted ? 'success' : 'ambar'}>
                      {kit.acceptanceStatus}
                    </Badge>
                  </Td>
                  <Td>{kit.itemCount}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDetailId(kit.id)}>
                        Ver detalle
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(kit)}>
                        Eliminar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Este grupo aún no tiene kits asignados." />
        )}
      </div>

      {assignOpen && (
        <AssignKitModal
          courseId={courseId}
          groupId={groupId}
          onClose={() => setAssignOpen(false)}
        />
      )}
      {detailId && (
        <KitDetailModal
          courseId={courseId}
          groupId={groupId}
          kitId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar kit"
        message={deleting ? `¿Eliminar el kit "${deleting.code}"? Se libera su stock.` : ''}
        confirmLabel="Eliminar"
        danger
        loading={deleteKit.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

interface ItemRow {
  componentId: string;
  quantity: string;
}

function AssignKitModal({
  courseId,
  groupId,
  onClose,
}: {
  courseId: string;
  groupId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const templates = useKitTemplates();
  const components = useComponents('');
  const assignKit = useAssignKit(courseId, groupId);

  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [code, setCode] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([{ componentId: '', quantity: '1' }]);
  const [error, setError] = useState<string | null>(null);
  const [shortages, setShortages] = useState<Shortage[] | null>(null);

  const submit = () => {
    setError(null);
    setShortages(null);
    const trimmedCode = code.trim();
    if (!trimmedCode) return setError('El código es obligatorio.');

    let input: AssignKitInput;
    if (mode === 'template') {
      if (!templateId) return setError('Selecciona una plantilla.');
      input = { code: trimmedCode, templateId };
    } else {
      if (rows.some((r) => !r.componentId))
        return setError('Selecciona el componente en cada fila.');
      const ids = rows.map((r) => r.componentId);
      if (new Set(ids).size !== ids.length) return setError('Hay componentes duplicados.');
      const items = rows.map((r) => ({ componentId: r.componentId, quantity: Number(r.quantity) }));
      if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1))
        return setError('Cada cantidad debe ser un entero ≥ 1.');
      input = { code: trimmedCode, items };
    }

    assignKit.mutate(input, {
      onSuccess: () => {
        toast.success('Kit asignado.');
        onClose();
      },
      onError: (err) => {
        const s = extractShortages(err);
        if (s) setShortages(s);
        else setError(getApiErrorMessage(err));
      },
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Asignar kit"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={assignKit.isPending}>
            {assignKit.isPending ? 'Asignando…' : 'Asignar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Código del kit"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K-001"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('template')}
            className={`flex-1 rounded-[var(--radius)] border px-3 py-2 text-sm font-semibold ${
              mode === 'template'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-text-secondary'
            }`}
          >
            Desde plantilla
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`flex-1 rounded-[var(--radius)] border px-3 py-2 text-sm font-semibold ${
              mode === 'custom'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-text-secondary'
            }`}
          >
            A medida
          </button>
        </div>

        {mode === 'template' ? (
          <Select
            label="Plantilla"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {(templates.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.itemCount} ítems)
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-text-secondary">Componentes</span>
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    value={row.componentId}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...next[idx], componentId: e.target.value };
                      setRows(next);
                    }}
                  >
                    <option value="">Selecciona…</option>
                    {(components.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.available} disp.)
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  type="number"
                  className="w-24"
                  value={row.quantity}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...next[idx], quantity: e.target.value };
                    setRows(next);
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                  disabled={rows.length === 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows([...rows, { componentId: '', quantity: '1' }])}
              className="self-start text-sm font-semibold text-primary hover:underline"
            >
              + Agregar componente
            </button>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {shortages && (
          <div className="rounded-[var(--radius)] border border-danger/30 bg-danger/10 p-3 text-sm">
            <p className="font-semibold text-danger">Stock insuficiente:</p>
            <ul className="mt-1 space-y-0.5 text-danger">
              {shortages.map((s) => (
                <li key={s.componentId}>
                  {s.name}: pediste {s.requested}, disponible {s.available}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function KitDetailModal({
  courseId,
  groupId,
  kitId,
  onClose,
}: {
  courseId: string;
  groupId: string;
  kitId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const kit = useKit(courseId, groupId, kitId);
  const returnItem = useReturnKitItem(courseId, groupId, kitId);
  // Ítem cuyo modal de devolución está abierto (la nota necesita un textarea).
  const [returning, setReturning] = useState<KitItem | null>(null);

  const doReturn = (quantity: number, note: string) => {
    if (!returning) return;
    returnItem.mutate(
      { kitItemId: returning.id, quantity, note: note || undefined },
      {
        onSuccess: () => {
          toast.success('Devolución registrada.');
          setReturning(null);
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Kit ${kit.data?.code ?? ''}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {kit.isLoading ? (
        <Loading />
      ) : kit.isError ? (
        <ErrorState message={getApiErrorMessage(kit.error)} />
      ) : kit.data ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            <Badge tone={KIT_TONE[kit.data.status]}>{kitLabel[kit.data.status]}</Badge>
            <VerificationBadge kit={kit.data} />
          </div>

          <VerificationPanel kit={kit.data} />
          <AcceptancePanel kit={kit.data} />

          <h4 className="mt-1 text-sm font-bold text-text-primary">Devoluciones</h4>
          {/* Tarjetas apiladas: la timeline no cabe dentro de una tabla en móvil. */}
          <div className="flex flex-col gap-2">
            {kit.data.items.map((it) => (
              <div
                key={it.id}
                className="min-w-0 rounded-[var(--radius)] border border-border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-text-primary">
                      {it.componentName}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {it.returnedQuantity} de {it.quantity} devuelto(s) ·{' '}
                      <span
                        className={it.pending > 0 ? 'font-semibold text-warning' : 'text-success'}
                      >
                        {it.pending} pendiente(s)
                      </span>
                    </p>
                  </div>
                  {it.pending > 0 ? (
                    <Button size="sm" onClick={() => setReturning(it)}>
                      Devolver
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-success">Completo</span>
                  )}
                </div>

                {it.hasReturnNotes && <ReturnNotesFlag className="mt-2" />}
                <ReturnTimeline events={it.returnEvents} className="mt-2" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {returning && (
        <ReturnModal
          componentName={returning.componentName}
          pending={returning.pending}
          loading={returnItem.isPending}
          onConfirm={doReturn}
          onClose={() => setReturning(null)}
        />
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Paneles de verificación y aceptaciones (vista profesor/ayudante)
// ----------------------------------------------------------------------------

/** Resultado de la verificación de entrega, ítem por ítem, con las notas del alumno. */
function VerificationPanel({ kit }: { kit: Kit }) {
  if (!kit.isVerified) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-gray-50 px-3 py-2 text-sm text-text-secondary">
        El grupo aún no ha verificado la entrega de este kit.
      </div>
    );
  }

  const issues = kit.items.filter((it) => !it.verified || it.verificationNote);

  return (
    <div className="rounded-[var(--radius)] border border-border p-3">
      <p className="text-sm text-text-secondary">
        Verificado por{' '}
        <strong className="text-text-primary">{kit.verifiedBy?.name ?? '—'}</strong> el{' '}
        {formatDateTime(kit.verifiedAt)}.
      </p>

      {issues.length > 0 && (
        <p className="mt-2 rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {issues.length} ítem(s) con discrepancia. No se ajustó ninguna cantidad ni el stock: tú
          decides qué hacer.
        </p>
      )}

      <ul className="mt-2 flex flex-col gap-1.5">
        {kit.items.map((it) => (
          <li key={it.id} className="flex min-w-0 items-start gap-2 text-sm">
            <span
              aria-hidden
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                it.verified ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
              }`}
            >
              {it.verified ? '✓' : '✕'}
            </span>
            <div className="min-w-0 flex-1">
              <span className="break-words font-semibold text-text-primary">
                {it.componentName}
              </span>{' '}
              <span className="text-text-secondary">×{it.quantity}</span>
              {!it.verified && (
                <span className="ml-1 text-xs font-semibold text-danger">no recibido</span>
              )}
              {it.verificationNote && (
                <p className="mt-0.5 break-words rounded bg-gray-50 px-2 py-1 text-xs text-text-primary">
                  “{it.verificationNote}”
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Quiénes aceptaron las condiciones, cuándo, y quiénes faltan. */
function AcceptancePanel({ kit }: { kit: Kit }) {
  const acceptances = kit.acceptances;
  if (!acceptances) return null;

  return (
    <div className="rounded-[var(--radius)] border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-text-primary">Condiciones de préstamo</h4>
        <Badge tone={acceptances.pending.length === 0 ? 'success' : 'ambar'}>
          {acceptances.accepted} de {acceptances.total} aceptaron
        </Badge>
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {acceptances.members.map((m) => (
          <li key={m.studentId} className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="min-w-0 break-words font-semibold text-text-primary">{m.name}</span>
            {m.accepted ? (
              <span className="text-xs text-success">Aceptó el {formatDateTime(m.acceptedAt)}</span>
            ) : (
              <span className="text-xs font-semibold text-ocre">Pendiente</span>
            )}
          </li>
        ))}
      </ul>

      {acceptances.pending.length > 0 && (
        <p className="mt-2 break-words text-xs text-text-secondary">
          Faltan: <span className="font-semibold text-ocre">{acceptances.pending.join(', ')}</span>
        </p>
      )}
    </div>
  );
}
