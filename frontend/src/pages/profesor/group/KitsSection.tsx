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
import type { Kit, KitStatus, Shortage } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

const KIT_TONE: Record<KitStatus, BadgeTone> = { ASSIGNED: 'ambar', RETURNED: 'success' };
const kitLabel: Record<KitStatus, string> = { ASSIGNED: 'Asignado', RETURNED: 'Devuelto' };

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
                <Th>Ítems</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {kits.data.map((kit) => (
                <tr key={kit.id}>
                  <Td className="font-semibold">{kit.code}</Td>
                  <Td>
                    <Badge tone={KIT_TONE[kit.status]}>{kitLabel[kit.status]}</Badge>
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
  const [qty, setQty] = useState<Record<string, string>>({});

  const doReturn = (kitItemId: string, pending: number) => {
    const quantity = Number(qty[kitItemId] ?? '1');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > pending) {
      toast.error(`Cantidad inválida (1 a ${pending}).`);
      return;
    }
    returnItem.mutate(
      { kitItemId, quantity },
      {
        onSuccess: () => {
          toast.success('Devolución registrada.');
          setQty((q) => ({ ...q, [kitItemId]: '' }));
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
          <div>
            <Badge tone={KIT_TONE[kit.data.status]}>{kitLabel[kit.data.status]}</Badge>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Componente</Th>
                <Th>Cant.</Th>
                <Th>Devuelto</Th>
                <Th>Pend.</Th>
                <Th className="text-right">Devolver</Th>
              </tr>
            </thead>
            <tbody>
              {kit.data.items.map((it) => (
                <tr key={it.id}>
                  <Td className="font-semibold">{it.componentName}</Td>
                  <Td>{it.quantity}</Td>
                  <Td>{it.returnedQuantity}</Td>
                  <Td>
                    <span
                      className={it.pending > 0 ? 'text-warning font-semibold' : 'text-success'}
                    >
                      {it.pending}
                    </span>
                  </Td>
                  <Td className="text-right">
                    {it.pending > 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={1}
                          max={it.pending}
                          value={qty[it.id] ?? ''}
                          placeholder={String(it.pending)}
                          onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))}
                          className="w-16 rounded-[var(--radius)] border border-border px-2 py-1 text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => doReturn(it.id, it.pending)}
                          disabled={returnItem.isPending}
                        >
                          OK
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-success">Completo</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}
    </Modal>
  );
}
