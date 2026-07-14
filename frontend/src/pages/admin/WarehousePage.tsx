import { useState } from 'react';
import {
  useComponents,
  useComponent,
  useCreateComponent,
  useUpdateComponent,
  useDeleteComponent,
  type ComponentInput,
} from '@/api/components';
import {
  useKitTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type TemplateInput,
} from '@/api/templates';
import { getApiErrorMessage } from '@/lib/errors';
import type { Component, KitTemplate } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

type Tab = 'components' | 'templates';

export function WarehousePage() {
  const [tab, setTab] = useState<Tab>('components');

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-text-primary">Bodega</h1>
      <p className="mt-1 text-text-secondary">Componentes y plantillas de kit.</p>

      <div className="mt-5 flex gap-1 border-b border-border">
        <TabButton active={tab === 'components'} onClick={() => setTab('components')}>
          Componentes
        </TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
          Plantillas de kit
        </TabButton>
      </div>

      <div className="mt-5">
        {tab === 'components' ? <ComponentsSection /> : <TemplatesSection />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Componentes
// ----------------------------------------------------------------------------

interface ComponentFormState {
  name: string;
  description: string;
  totalStock: string;
}

function ComponentsSection() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useComponents(search);
  const createComponent = useCreateComponent();
  const updateComponent = useUpdateComponent();
  const deleteComponent = useDeleteComponent();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [form, setForm] = useState<ComponentFormState>({
    name: '',
    description: '',
    totalStock: '0',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Component | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', totalStock: '0' });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (c: Component) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? '', totalStock: String(c.totalStock) });
    setFormError(null);
    setFormOpen(true);
  };

  const submit = () => {
    const name = form.name.trim();
    const totalStock = Number(form.totalStock);
    if (!name) return setFormError('El nombre es obligatorio.');
    if (!Number.isInteger(totalStock) || totalStock < 0)
      return setFormError('El stock total debe ser un entero ≥ 0.');

    const input: ComponentInput = {
      name,
      description: form.description.trim() || undefined,
      totalStock,
    };
    const onError = (err: unknown) => setFormError(getApiErrorMessage(err));
    if (editing) {
      updateComponent.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success('Componente actualizado.');
            setFormOpen(false);
          },
          onError,
        },
      );
    } else {
      createComponent.mutate(input, {
        onSuccess: () => {
          toast.success('Componente creado.');
          setFormOpen(false);
        },
        onError,
      });
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteComponent.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Componente eliminado.');
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
      <div className="flex items-end justify-between gap-3">
        <div className="w-72">
          <Input
            label="Buscar componente"
            placeholder="Nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>Nuevo componente</Button>
      </div>

      <div className="mt-4">
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState message={getApiErrorMessage(query.error)} />
        ) : query.data && query.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Descripción</Th>
                <Th>Stock</Th>
                <Th>Disponible</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((c) => (
                <tr key={c.id}>
                  <Td className="font-semibold">{c.name}</Td>
                  <Td className="text-text-secondary">{c.description ?? '—'}</Td>
                  <Td>{c.totalStock}</Td>
                  <Td>
                    <span
                      className={`font-semibold ${c.available > 0 ? 'text-success' : 'text-danger'}`}
                    >
                      {c.available}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(c.id)}>
                        Ver
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(c)}>
                        Eliminar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="No hay componentes que coincidan." />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar componente' : 'Nuevo componente'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={createComponent.isPending || updateComponent.isPending}
            >
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Descripción (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Stock total"
            type="number"
            className="w-32"
            value={form.totalStock}
            onChange={(e) => setForm({ ...form, totalStock: e.target.value })}
          />
          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Modal>

      <ComponentDetailModal id={detailId} onClose={() => setDetailId(null)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar componente"
        message={deleting ? `¿Eliminar "${deleting.name}"?` : ''}
        confirmLabel="Eliminar"
        danger
        loading={deleteComponent.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function ComponentDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const query = useComponent(id);
  return (
    <Modal open={Boolean(id)} onClose={onClose} title="Detalle del componente">
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={getApiErrorMessage(query.error)} />
      ) : query.data ? (
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Nombre" value={query.data.name} />
          <Row label="Descripción" value={query.data.description ?? '—'} />
          <Row label="Stock total" value={String(query.data.totalStock)} />
          <Row label="Comprometido en kits" value={String(query.data.inKits)} />
          <Row label="Comprometido en préstamos" value={String(query.data.inLoans)} />
          <div className="mt-1 border-t border-border pt-2">
            <Row
              label="Disponible"
              value={String(query.data.available)}
              highlight={query.data.available > 0 ? 'success' : 'danger'}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'success' | 'danger';
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-secondary">{label}</span>
      <span
        className={`font-semibold ${
          highlight === 'success'
            ? 'text-success'
            : highlight === 'danger'
              ? 'text-danger'
              : 'text-text-primary'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Plantillas de kit
// ----------------------------------------------------------------------------

interface ItemRow {
  componentId: string;
  quantity: string;
}

function TemplatesSection() {
  const toast = useToast();
  const templatesQuery = useKitTemplates();
  const componentsQuery = useComponents('');
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KitTemplate | null>(null);
  const [name, setName] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([{ componentId: '', quantity: '1' }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<KitTemplate | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setRows([{ componentId: '', quantity: '1' }]);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (t: KitTemplate) => {
    setEditing(t);
    setName(t.name);
    setRows(t.items.map((i) => ({ componentId: i.component.id, quantity: String(i.quantity) })));
    setFormError(null);
    setFormOpen(true);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setFormError('El nombre es obligatorio.');
    if (rows.length === 0) return setFormError('Agrega al menos un componente.');
    if (rows.some((r) => !r.componentId))
      return setFormError('Selecciona el componente en cada fila.');

    const ids = rows.map((r) => r.componentId);
    if (new Set(ids).size !== ids.length)
      return setFormError('Hay componentes duplicados; combínalos en una sola fila.');

    const items = rows.map((r) => ({ componentId: r.componentId, quantity: Number(r.quantity) }));
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1))
      return setFormError('Cada cantidad debe ser un entero ≥ 1.');

    const input: TemplateInput = { name: trimmed, items };
    const onError = (err: unknown) => setFormError(getApiErrorMessage(err));
    if (editing) {
      updateTemplate.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success('Plantilla actualizada.');
            setFormOpen(false);
          },
          onError,
        },
      );
    } else {
      createTemplate.mutate(input, {
        onSuccess: () => {
          toast.success('Plantilla creada.');
          setFormOpen(false);
        },
        onError,
      });
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteTemplate.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Plantilla eliminada.');
        setDeleting(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setDeleting(null);
      },
    });
  };

  const components = componentsQuery.data ?? [];

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={openCreate}>Nueva plantilla</Button>
      </div>

      <div className="mt-4">
        {templatesQuery.isLoading ? (
          <Loading />
        ) : templatesQuery.isError ? (
          <ErrorState message={getApiErrorMessage(templatesQuery.error)} />
        ) : templatesQuery.data && templatesQuery.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Plantilla</Th>
                <Th>Componentes</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {templatesQuery.data.map((t) => (
                <tr key={t.id}>
                  <Td className="font-semibold">{t.name}</Td>
                  <Td className="text-text-secondary">
                    {t.itemCount} ítem(s):{' '}
                    {t.items.map((i) => `${i.component.name} ×${i.quantity}`).join(', ')}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(t)}>
                        Eliminar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Aún no hay plantillas." />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar plantilla' : 'Nueva plantilla'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={createTemplate.isPending || updateTemplate.isPending}
            >
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />

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
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
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

          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar plantilla"
        message={deleting ? `¿Eliminar la plantilla "${deleting.name}"?` : ''}
        confirmLabel="Eliminar"
        danger
        loading={deleteTemplate.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
