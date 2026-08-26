import { useMemo, useState } from 'react';
import {
  useComponents,
  useComponent,
  useCreateComponent,
  useUpdateComponent,
  useDeleteComponent,
  type ComponentInput,
} from '@/api/components';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/api/tags';
import {
  useKitTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type TemplateInput,
} from '@/api/templates';
import { useDebounced } from '@/hooks/useDebounced';
import { getApiErrorMessage } from '@/lib/errors';
import type { Component, KitTemplate, Tag, TagRef } from '@/lib/apiTypes';
import { DEFAULT_TAG_COLOR, normalizeHex, tagStyles } from '@/lib/tagColor';
import { useToast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TagBadgeList } from '@/components/ui/TagBadge';
import { TagChips } from '@/components/ui/TagChips';
import { TagMultiSelect } from '@/components/ui/TagMultiSelect';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

type Tab = 'components' | 'templates' | 'tags';

export function WarehousePage() {
  const [tab, setTab] = useState<Tab>('components');

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-text-primary">Bodega</h1>
      <p className="mt-1 text-text-secondary">Componentes, etiquetas y plantillas de kit.</p>

      {/* Scroll horizontal en las pestañas para que no desborden a ~375px. */}
      <div className="mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-1 border-b border-border">
          <TabButton active={tab === 'components'} onClick={() => setTab('components')}>
            Componentes
          </TabButton>
          <TabButton active={tab === 'tags'} onClick={() => setTab('tags')}>
            Etiquetas
          </TabButton>
          <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
            Plantillas de kit
          </TabButton>
        </div>
      </div>

      <div className="mt-5">
        {tab === 'components' ? (
          <ComponentsSection />
        ) : tab === 'tags' ? (
          <TagsSection />
        ) : (
          <TemplatesSection />
        )}
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
      className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
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
  code: string;
  description: string;
  totalStock: string;
  tagIds: string[];
}

const EMPTY_FORM: ComponentFormState = {
  name: '',
  code: '',
  description: '',
  totalStock: '0',
  tagIds: [],
};

type ViewMode = 'grouped' | 'flat';

/** Etiqueta sintética para los componentes que no tienen ninguna. */
const UNTAGGED: TagRef = { id: '__untagged__', name: 'Sin etiqueta', color: '#9aa5b5' };

function ComponentsSection() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [view, setView] = useState<ViewMode>('grouped');

  const tagsQuery = useTags();
  const query = useComponents({ search: debouncedSearch, tagIds: selectedTagIds });
  const createComponent = useCreateComponent();
  const updateComponent = useUpdateComponent();
  const deleteComponent = useDeleteComponent();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [form, setForm] = useState<ComponentFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Component | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const hasFilters = Boolean(search.trim()) || selectedTagIds.length > 0;

  const toggleTagFilter = (id: string) =>
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const clearFilters = () => {
    setSearch('');
    setSelectedTagIds([]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (c: Component) => {
    setEditing(c);
    setForm({
      name: c.name,
      code: c.code ?? '',
      description: c.description ?? '',
      totalStock: String(c.totalStock),
      tagIds: c.tags.map((t) => t.id),
    });
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
      // Cadena vacía → null: el backend limpia el código en ese caso.
      code: form.code.trim() || null,
      description: form.description.trim() || undefined,
      totalStock,
      tagIds: form.tagIds,
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

  const components = useMemo(() => query.data ?? [], [query.data]);

  /**
   * Agrupa por etiqueta. Un componente con N etiquetas aparece en las N secciones;
   * los que no tienen ninguna caen en la sección final "Sin etiqueta".
   */
  const groups = useMemo(() => {
    const byTag = new Map<string, { tag: TagRef; items: Component[] }>();
    const untagged: Component[] = [];

    for (const c of components) {
      if (c.tags.length === 0) {
        untagged.push(c);
        continue;
      }
      for (const t of c.tags) {
        const entry = byTag.get(t.id) ?? { tag: t, items: [] };
        entry.items.push(c);
        byTag.set(t.id, entry);
      }
    }

    const sections = [...byTag.values()].sort((a, b) => a.tag.name.localeCompare(b.tag.name));
    if (untagged.length > 0) sections.push({ tag: UNTAGGED, items: untagged });
    return sections;
  }, [components]);

  const actions = { onDetail: setDetailId, onEdit: openEdit, onDelete: setDeleting };

  return (
    <div>
      {/* Barra de búsqueda: ancho completo en móvil, con el botón debajo. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Input
            label="Buscar componente"
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          Nuevo componente
        </Button>
      </div>

      {/* Filtros por etiqueta */}
      <div className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Filtrar por etiqueta
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="mt-2">
          {tagsQuery.isLoading ? (
            <p className="text-sm text-text-muted">Cargando etiquetas…</p>
          ) : (
            <TagChips
              tags={tags}
              selectedIds={selectedTagIds}
              onToggle={toggleTagFilter}
              showCount
              emptyMessage="Aún no hay etiquetas. Créalas en la pestaña «Etiquetas»."
            />
          )}
        </div>
      </div>

      {/* Toggle de vista */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">
          {components.length} componente(s)
          {selectedTagIds.length > 0 && ` · ${selectedTagIds.length} etiqueta(s) activa(s)`}
        </span>
        <div className="inline-flex rounded-[var(--radius)] border border-border bg-surface-card p-0.5">
          <ViewToggleButton active={view === 'grouped'} onClick={() => setView('grouped')}>
            Agrupado
          </ViewToggleButton>
          <ViewToggleButton active={view === 'flat'} onClick={() => setView('flat')}>
            Plano
          </ViewToggleButton>
        </div>
      </div>

      <div className="mt-4">
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState message={getApiErrorMessage(query.error)} />
        ) : components.length === 0 ? (
          <EmptyState message="No hay componentes que coincidan." />
        ) : view === 'flat' ? (
          <ComponentList components={components} {...actions} />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map(({ tag, items }) => (
              <section
                key={tag.id}
                className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-card"
              >
                <header
                  className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5"
                  style={tagStyles(tag.color)}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: normalizeHex(tag.color) }}
                  />
                  <h3 className="min-w-0 truncate text-sm font-bold">{tag.name}</h3>
                  <span className="ml-auto shrink-0 text-xs font-semibold opacity-80">
                    {items.length} ítem(s)
                  </span>
                </header>
                <ComponentList components={items} bare {...actions} />
              </section>
            ))}
          </div>
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
            label="Código (opcional)"
            placeholder="Ej. RES-220"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
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
          <TagMultiSelect
            tags={tags}
            selectedIds={form.tagIds}
            onChange={(tagIds) => setForm({ ...form, tagIds })}
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

function ViewToggleButton({
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
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-primary text-text-on-primary' : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

interface ComponentListProps {
  components: Component[];
  onDetail: (id: string) => void;
  onEdit: (c: Component) => void;
  onDelete: (c: Component) => void;
  /** Dentro de una sección agrupada: sin borde/tarjeta propia. */
  bare?: boolean;
}

/**
 * Listado responsive: tarjetas apiladas en móvil, tabla desde `sm`.
 * (La tabla no cabe a 375px sin scroll horizontal.)
 */
function ComponentList({ components, onDetail, onEdit, onDelete, bare }: ComponentListProps) {
  const rowActions = (c: Component) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="ghost" onClick={() => onDetail(c.id)}>
        Ver
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onEdit(c)}>
        Editar
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onDelete(c)}>
        Eliminar
      </Button>
    </div>
  );

  return (
    <>
      {/* Móvil: tarjetas apiladas */}
      <div className={`flex flex-col gap-3 sm:hidden ${bare ? 'p-3' : ''}`}>
        {components.map((c) => (
          <div
            key={c.id}
            className={`min-w-0 rounded-[var(--radius-card)] p-3 ${
              bare ? 'border border-border' : 'border border-border bg-surface-card'
            }`}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{c.name}</p>
                {c.code && (
                  <p className="mt-0.5 truncate font-mono text-xs text-text-muted">{c.code}</p>
                )}
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${
                  c.available > 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {c.available}/{c.totalStock}
              </span>
            </div>
            {c.description && (
              <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{c.description}</p>
            )}
            <TagBadgeList tags={c.tags} className="mt-2" />
            <div className="mt-2 border-t border-border pt-2">{rowActions(c)}</div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla. `table-fixed` mantiene las columnas alineadas entre
          secciones agrupadas (si no, cada tabla calcula anchos distintos). */}
      <div
        className={
          bare
            ? 'hidden overflow-x-auto sm:block'
            : 'hidden overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface-card sm:block'
        }
      >
        <table className="w-full table-fixed border-collapse text-sm">
          <ComponentTableBody
            components={components}
            rowActions={rowActions}
            firstRowBorderless={bare}
          />
        </table>
      </div>
    </>
  );
}

function ComponentTableBody({
  components,
  rowActions,
  firstRowBorderless = false,
}: {
  components: Component[];
  rowActions: (c: Component) => React.ReactNode;
  firstRowBorderless?: boolean;
}) {
  return (
    <>
      <thead>
        <tr>
          <Th>Componente</Th>
          <Th className="w-[26%]">Etiquetas</Th>
          <Th className="w-20">Stock</Th>
          <Th className="w-28">Disponible</Th>
          <Th className="w-[15.5rem] text-right">Acciones</Th>
        </tr>
      </thead>
      <tbody>
        {components.map((c, idx) => (
          <tr key={c.id}>
            <Td className={firstRowBorderless && idx === 0 ? 'border-t-0' : undefined}>
              <span className="font-semibold break-words">{c.name}</span>
              {c.code && (
                <span className="ml-2 inline-block whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                  {c.code}
                </span>
              )}
              {c.description && (
                <p className="mt-0.5 text-xs text-text-secondary">{c.description}</p>
              )}
            </Td>
            <Td className={firstRowBorderless && idx === 0 ? 'border-t-0' : undefined}>
              {c.tags.length > 0 ? (
                <TagBadgeList tags={c.tags} />
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </Td>
            <Td className={firstRowBorderless && idx === 0 ? 'border-t-0' : undefined}>
              {c.totalStock}
            </Td>
            <Td className={firstRowBorderless && idx === 0 ? 'border-t-0' : undefined}>
              <span className={`font-semibold ${c.available > 0 ? 'text-success' : 'text-danger'}`}>
                {c.available}
              </span>
            </Td>
            <Td
              className={`text-right ${firstRowBorderless && idx === 0 ? 'border-t-0' : ''}`}
            >
              {rowActions(c)}
            </Td>
          </tr>
        ))}
      </tbody>
    </>
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
          <Row label="Código" value={query.data.code ?? '—'} />
          <Row label="Descripción" value={query.data.description ?? '—'} />
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-text-secondary">Etiquetas</span>
            {query.data.tags.length > 0 ? (
              <TagBadgeList tags={query.data.tags} className="justify-end" />
            ) : (
              <span className="font-semibold text-text-primary">—</span>
            )}
          </div>
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
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span
        className={`min-w-0 break-words text-right font-semibold ${
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
// Etiquetas
// ----------------------------------------------------------------------------

function TagsSection() {
  const toast = useToast();
  const tagsQuery = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_TAG_COLOR);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(DEFAULT_TAG_COLOR);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setName(tag.name);
    setColor(normalizeHex(tag.color));
    setFormError(null);
    setFormOpen(true);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setFormError('El nombre es obligatorio.');

    const input = { name: trimmed, color };
    const onError = (err: unknown) => setFormError(getApiErrorMessage(err));
    if (editing) {
      updateTag.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success('Etiqueta actualizada.');
            setFormOpen(false);
          },
          onError,
        },
      );
    } else {
      createTag.mutate(input, {
        onSuccess: () => {
          toast.success('Etiqueta creada.');
          setFormOpen(false);
        },
        onError,
      });
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteTag.mutate(deleting.id, {
      onSuccess: (res) => {
        toast.success(
          res.detachedComponents > 0
            ? `Etiqueta eliminada; se desasoció de ${res.detachedComponents} componente(s).`
            : 'Etiqueta eliminada.',
        );
        setDeleting(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setDeleting(null);
      },
    });
  };

  const tags = tagsQuery.data ?? [];

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Las etiquetas agrupan componentes en la bodega. Eliminar una etiqueta{' '}
          <strong>no elimina</strong> los componentes.
        </p>
        <Button onClick={openCreate} className="w-full shrink-0 sm:w-auto">
          Nueva etiqueta
        </Button>
      </div>

      <div className="mt-4">
        {tagsQuery.isLoading ? (
          <Loading />
        ) : tagsQuery.isError ? (
          <ErrorState message={getApiErrorMessage(tagsQuery.error)} />
        ) : tags.length === 0 ? (
          <EmptyState message="Aún no hay etiquetas." />
        ) : (
          <div className="flex flex-col gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex min-w-0 flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface-card p-3"
              >
                <span
                  aria-hidden
                  className="h-8 w-8 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: normalizeHex(tag.color) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-text-primary">{tag.name}</p>
                  <p className="text-xs text-text-secondary">
                    {tag.componentsCount} componente(s) · {normalizeHex(tag.color)}
                  </p>
                </div>
                {/* En móvil las acciones bajan a su propia línea (si no, el nombre se trunca). */}
                <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(tag)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(tag)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar etiqueta' : 'Nueva etiqueta'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={createTag.isPending || updateTag.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-text-secondary">Color</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Color de la etiqueta"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-[var(--radius)] border border-border bg-surface-card p-1"
              />
              <span className="font-mono text-sm text-text-secondary">{color}</span>
              <span
                style={tagStyles(color)}
                className="ml-auto inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-xs font-semibold"
              >
                {name.trim() || 'Vista previa'}
              </span>
            </div>
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar etiqueta"
        message={
          deleting
            ? `¿Eliminar la etiqueta "${deleting.name}"? Los ${deleting.componentsCount} componente(s) asociado(s) NO se eliminan: solo se les quita esta etiqueta.`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleteTag.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
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

const MAX_BULK_ROWS = 50;

/** Normaliza el input de "agregar N filas" al rango 1–50. */
function clampBulk(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_BULK_ROWS);
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
  // Índices de filas señaladas en rojo por la validación (sin componente o duplicadas).
  const [rowErrors, setRowErrors] = useState<Set<number>>(new Set());
  const [bulkCount, setBulkCount] = useState('5');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setRows([{ componentId: '', quantity: '1' }]);
    setFormError(null);
    setRowErrors(new Set());
    setFormOpen(true);
  };

  const openEdit = (t: KitTemplate) => {
    setEditing(t);
    setName(t.name);
    setRows(t.items.map((i) => ({ componentId: i.component.id, quantity: String(i.quantity) })));
    setFormError(null);
    setRowErrors(new Set());
    setFormOpen(true);
  };

  const fail = (message: string, badRows: number[] = []) => {
    setRowErrors(new Set(badRows));
    setFormError(message);
    // Con 20+ filas el mensaje del pie queda fuera de vista: lleva la vista a la
    // primera fila marcada. rAF para que el borde rojo ya esté en el DOM.
    if (badRows.length > 0) {
      requestAnimationFrame(() => {
        document
          .querySelector('[role="dialog"] [aria-invalid="true"]')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return fail('El nombre es obligatorio.');
    if (rows.length === 0) return fail('Agrega al menos un componente.');

    const empty = rows.map((r, i) => (r.componentId ? -1 : i)).filter((i) => i >= 0);
    if (empty.length > 0)
      return fail(
        `Faltan ${empty.length} fila(s) por completar. Elige el componente o usa «Quitar filas vacías».`,
        empty,
      );

    // Índices de TODAS las filas que comparten componente, para marcarlas todas.
    const seen = new Map<string, number[]>();
    rows.forEach((r, i) => seen.set(r.componentId, [...(seen.get(r.componentId) ?? []), i]));
    const dupes = [...seen.values()].filter((idx) => idx.length > 1).flat();
    if (dupes.length > 0)
      return fail('Hay componentes duplicados; combínalos en una sola fila.', dupes);

    const items = rows.map((r) => ({ componentId: r.componentId, quantity: Number(r.quantity) }));
    const badQty = items
      .map((i, idx) => (Number.isInteger(i.quantity) && i.quantity >= 1 ? -1 : idx))
      .filter((i) => i >= 0);
    if (badQty.length > 0) return fail('Cada cantidad debe ser un entero ≥ 1.', badQty);

    setRowErrors(new Set());

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
  const emptyRowCount = rows.filter((r) => !r.componentId).length;
  const bulkN = clampBulk(bulkCount);

  /** Inserta N filas vacías de una vez (plantillas de 20+ componentes). */
  const addBulkRows = () => {
    setRows([...rows, ...Array.from({ length: bulkN }, () => ({ componentId: '', quantity: '1' }))]);
    setFormError(null);
  };

  /** Descarta las filas sin componente; deja siempre al menos una. */
  const removeEmptyRows = () => {
    const kept = rows.filter((r) => r.componentId);
    setRows(kept.length > 0 ? kept : [{ componentId: '', quantity: '1' }]);
    setRowErrors(new Set());
    setFormError(null);
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
    // Los índices se corren al borrar: recalcular en el próximo submit.
    setRowErrors(new Set());
  };

  const clearRowError = (idx: number) => {
    setRowErrors((prev) => {
      if (!prev.has(idx)) return prev;
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  };

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={openCreate} className="w-full sm:w-auto">
          Nueva plantilla
        </Button>
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
            <Button onClick={submit} disabled={createTemplate.isPending || updateTemplate.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-text-secondary">Componentes</span>
              <span className="text-xs text-text-secondary">
                {rows.length} fila(s)
                {emptyRowCount > 0 && ` · ${emptyRowCount} sin completar`}
              </span>
            </div>

            {rows.map((row, idx) => {
              const invalid = rowErrors.has(idx);
              return (
                <div key={idx} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={row.componentId}
                      // Marca en rojo la fila señalada por la validación.
                      invalid={invalid}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...next[idx], componentId: e.target.value };
                        setRows(next);
                        clearRowError(idx);
                      }}
                    >
                      <option value="">Selecciona…</option>
                      {components.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `${c.name} (${c.code})` : c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Input
                    type="number"
                    className="w-20 shrink-0"
                    invalid={invalid}
                    value={row.quantity}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setRows(next);
                      clearRowError(idx);
                    }}
                  />
                  <Button
                    variant="ghost"
                    aria-label={`Quitar fila ${idx + 1}`}
                    onClick={() => removeRow(idx)}
                    disabled={rows.length === 1}
                  >
                    ✕
                  </Button>
                </div>
              );
            })}

            {/* Alta masiva: útil para plantillas largas (kits de 20+ componentes). */}
            <div className="mt-1 flex flex-col gap-2 rounded-[var(--radius)] border border-dashed border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={MAX_BULK_ROWS}
                  aria-label="Cantidad de filas a agregar"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(e.target.value)}
                  className="min-h-[44px] w-20 shrink-0 rounded-[var(--radius)] border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                />
                <Button variant="secondary" onClick={addBulkRows} className="shrink-0">
                  Agregar {bulkN} fila{bulkN === 1 ? '' : 's'}
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={removeEmptyRows}
                disabled={emptyRowCount === 0}
                className="shrink-0"
              >
                Quitar filas vacías
              </Button>
            </div>

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
