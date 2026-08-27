import { useState } from 'react';
import {
  useTermsDocuments,
  useTermsVersions,
  useCreateTermsDocument,
  useUpdateTermsDocument,
  useDeleteTermsDocument,
  useCreateTermsVersion,
  useUpdateTermsVersion,
  usePublishTermsVersion,
  useDeleteTermsVersion,
  type TermsVersionInput,
} from '@/api/terms';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { TermsDocumentSummary, TermsVersionRow } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Markdown } from '@/components/ui/Markdown';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

export function DocumentsPage() {
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const documents = useTermsDocuments();

  const openDoc = (documents.data ?? []).find((d) => d.id === openDocId) ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-text-primary">Documentos de condiciones</h1>
      <p className="mt-1 text-text-secondary">
        Textos que los alumnos firman al recibir su kit. Cada documento tiene versiones; las
        publicadas no se pueden modificar.
      </p>

      {openDoc ? (
        <DocumentDetail document={openDoc} onBack={() => setOpenDocId(null)} />
      ) : (
        <DocumentList query={documents} onOpen={setOpenDocId} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Lista de documentos
// ----------------------------------------------------------------------------

function DocumentList({
  query,
  onOpen,
}: {
  query: ReturnType<typeof useTermsDocuments>;
  onOpen: (id: string) => void;
}) {
  const toast = useToast();
  const createDoc = useCreateTermsDocument();
  const updateDoc = useUpdateTermsDocument();
  const deleteDoc = useDeleteTermsDocument();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TermsDocumentSummary | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TermsDocumentSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setFormError(null);
    setFormOpen(true);
  };

  const openRename = (doc: TermsDocumentSummary) => {
    setEditing(doc);
    setName(doc.name);
    setFormError(null);
    setFormOpen(true);
  };

  const submit = () => {
    const value = name.trim();
    if (!value) return setFormError('El nombre es obligatorio.');
    const onError = (err: unknown) => setFormError(getApiErrorMessage(err));
    const onSuccess = () => {
      toast.success(editing ? 'Documento renombrado.' : 'Documento creado.');
      setFormOpen(false);
    };
    if (editing) updateDoc.mutate({ id: editing.id, name: value }, { onSuccess, onError });
    else createDoc.mutate(value, { onSuccess, onError });
  };

  const makeDefault = (doc: TermsDocumentSummary) =>
    updateDoc.mutate(
      { id: doc.id, isDefault: true },
      {
        onSuccess: () => toast.success(`"${doc.name}" es ahora el predeterminado.`),
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );

  const confirmDelete = () => {
    if (!deleting) return;
    deleteDoc.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Documento eliminado.');
        setDeleting(null);
      },
      // Los 409 explican el motivo (es default / en uso / con firmas).
      onError: (err) => setDeleteError(getApiErrorMessage(err)),
    });
  };

  const docs = query.data ?? [];

  return (
    <div>
      <div className="mt-6 flex justify-end">
        <Button onClick={openCreate} className="w-full sm:w-auto">
          Nuevo documento
        </Button>
      </div>

      <div className="mt-4">
        {query.isLoading ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState message={getApiErrorMessage(query.error)} />
        ) : docs.length === 0 ? (
          <EmptyState message="Aún no hay documentos de condiciones." />
        ) : (
          <DocumentRows
            docs={docs}
            onOpen={onOpen}
            onRename={openRename}
            onMakeDefault={makeDefault}
            onDelete={(d) => {
              setDeleteError(null);
              setDeleting(d);
            }}
          />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Renombrar documento' : 'Nuevo documento'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={createDoc.isPending || updateDoc.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Nombre"
            placeholder="Ej: Condiciones Proyecto de Diseño"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-text-secondary">
            El documento nace sin versiones: después agrega la primera y publícala.
          </p>
          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar documento"
        message={
          deleteError
            ? deleteError
            : deleting
              ? `¿Eliminar "${deleting.name}" y sus ${deleting.versionCount} versión(es)?`
              : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleteDoc.isPending}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

interface DocumentRowsProps {
  docs: TermsDocumentSummary[];
  onOpen: (id: string) => void;
  onRename: (doc: TermsDocumentSummary) => void;
  onMakeDefault: (doc: TermsDocumentSummary) => void;
  onDelete: (doc: TermsDocumentSummary) => void;
}

function DocumentRows({ docs, onOpen, onRename, onMakeDefault, onDelete }: DocumentRowsProps) {
  const actions = (d: TermsDocumentSummary) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="secondary" onClick={() => onOpen(d.id)}>
        Ver versiones
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onRename(d)}>
        Renombrar
      </Button>
      {!d.isDefault && (
        <>
          <Button size="sm" variant="ghost" onClick={() => onMakeDefault(d)}>
            Predeterminado
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(d)}>
            Eliminar
          </Button>
        </>
      )}
    </div>
  );

  const current = (d: TermsDocumentSummary) =>
    d.currentVersion ? (
      <span className="break-words">
        <span className="font-semibold text-text-primary">{d.currentVersion.version}</span>{' '}
        <span className="text-text-secondary">· {d.currentVersion.title}</span>
      </span>
    ) : (
      <span className="text-xs font-semibold text-ocre">Sin versión publicada</span>
    );

  return (
    <>
      {/* Móvil: tarjetas apiladas. */}
      <div className="flex flex-col gap-3 sm:hidden">
        {docs.map((d) => (
          <div
            key={d.id}
            className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface-card p-3"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 break-words font-semibold text-text-primary">{d.name}</p>
              {d.isDefault && <Badge tone="terracota">Por defecto</Badge>}
            </div>
            <p className="mt-1 text-sm">{current(d)}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {d.versionCount} versión(es) · {d.coursesUsing} curso(s)
            </p>
            <div className="mt-2 border-t border-border pt-2">{actions(d)}</div>
          </div>
        ))}
      </div>

      {/* Desktop: tabla. */}
      <div className="hidden sm:block">
        <Table>
          <thead>
            <tr>
              <Th>Documento</Th>
              <Th>Versión vigente</Th>
              <Th>Versiones</Th>
              <Th>Cursos</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <Td>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="break-words font-semibold">{d.name}</span>
                    {d.isDefault && <Badge tone="terracota">Por defecto</Badge>}
                  </div>
                </Td>
                <Td>{current(d)}</Td>
                <Td>{d.versionCount}</Td>
                <Td>{d.coursesUsing}</Td>
                <Td className="text-right">{actions(d)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Detalle: versiones de un documento
// ----------------------------------------------------------------------------

function DocumentDetail({
  document,
  onBack,
}: {
  document: TermsDocumentSummary;
  onBack: () => void;
}) {
  const toast = useToast();
  const versions = useTermsVersions(document.id);
  const publishVersion = usePublishTermsVersion();
  const deleteVersion = useDeleteTermsVersion();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TermsVersionRow | null>(null);
  const [publishing, setPublishing] = useState<TermsVersionRow | null>(null);
  const [deleting, setDeleting] = useState<TermsVersionRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TermsVersionRow | null>(null);

  const rows = versions.data ?? [];

  const confirmPublish = () => {
    if (!publishing) return;
    publishVersion.mutate(publishing.id, {
      onSuccess: () => {
        toast.success(`Versión ${publishing.version} publicada.`);
        setPublishing(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setPublishing(null);
      },
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteVersion.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Borrador eliminado.');
        setDeleting(null);
      },
      onError: (err) => setDeleteError(getApiErrorMessage(err)),
    });
  };

  const status = (v: TermsVersionRow) =>
    v.isDraft ? <Badge tone="ambar">Borrador</Badge> : <Badge tone="success">Publicada</Badge>;

  const actions = (v: TermsVersionRow) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="ghost" onClick={() => setPreview(v)}>
        Ver
      </Button>
      {v.isDraft && (
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(v);
              setEditorOpen(true);
            }}
          >
            Editar
          </Button>
          <Button size="sm" onClick={() => setPublishing(v)}>
            Publicar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDeleteError(null);
              setDeleting(v);
            }}
          >
            Eliminar
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-sm text-primary hover:underline"
      >
        ← Volver a documentos
      </button>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-bold text-text-primary">{document.name}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {document.isDefault ? 'Documento por defecto · ' : ''}
            {document.coursesUsing} curso(s) lo usan
          </p>
        </div>
        <Button
          className="w-full shrink-0 sm:w-auto"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          Nueva versión
        </Button>
      </div>

      <div className="mt-5">
        {versions.isLoading ? (
          <Loading />
        ) : versions.isError ? (
          <ErrorState message={getApiErrorMessage(versions.error)} />
        ) : rows.length === 0 ? (
          <EmptyState message="Este documento aún no tiene versiones. Crea la primera." />
        ) : (
          <>
            {/* Móvil */}
            <div className="flex flex-col gap-3 sm:hidden">
              {rows.map((v) => (
                <div
                  key={v.id}
                  className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface-card p-3"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {v.version}
                    </span>
                    {status(v)}
                  </div>
                  <p className="mt-1 break-words text-sm text-text-primary">{v.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {v.createdBy.name} ·{' '}
                    {v.isDraft
                      ? `creada ${formatDateTime(v.createdAt)}`
                      : `publicada ${formatDateTime(v.publishedAt)}`}
                  </p>
                  <p className="text-xs text-text-secondary">{v.signatureCount} firma(s)</p>
                  <div className="mt-2 border-t border-border pt-2">{actions(v)}</div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Versión</Th>
                    <Th>Título</Th>
                    <Th>Estado</Th>
                    <Th>Autor / fecha</Th>
                    <Th>Firmas</Th>
                    <Th className="text-right">Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <Td className="font-mono font-bold">{v.version}</Td>
                      <Td className="break-words">{v.title}</Td>
                      <Td>{status(v)}</Td>
                      <Td className="text-xs text-text-secondary">
                        {v.createdBy.name}
                        <br />
                        {v.isDraft
                          ? formatDateTime(v.createdAt)
                          : formatDateTime(v.publishedAt)}
                      </Td>
                      <Td>{v.signatureCount}</Td>
                      <Td className="text-right">{actions(v)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </div>

      {editorOpen && (
        <VersionEditorModal
          documentId={document.id}
          version={editing}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {preview && (
        <Modal
          open
          onClose={() => setPreview(null)}
          title={`${preview.version} · ${preview.title}`}
          footer={<Button onClick={() => setPreview(null)}>Cerrar</Button>}
        >
          <Markdown>{preview.body}</Markdown>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(publishing)}
        title="Publicar versión"
        message={
          publishing
            ? `Al publicar "${publishing.version}" pasa a ser la versión vigente para los cursos que usen este documento. ` +
              'Las firmas ya registradas NO se invalidan: cada alumno conserva la versión que firmó. ' +
              'Una vez publicada, el texto no se puede modificar.'
            : ''
        }
        confirmLabel="Publicar"
        loading={publishVersion.isPending}
        onConfirm={confirmPublish}
        onCancel={() => setPublishing(null)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar borrador"
        message={
          deleteError ?? (deleting ? `¿Eliminar el borrador "${deleting.version}"?` : '')
        }
        confirmLabel="Eliminar"
        danger
        loading={deleteVersion.isPending}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Editor de versión (markdown + vista previa)
// ----------------------------------------------------------------------------

type EditorTab = 'edit' | 'preview';

const EDITOR_TABS: TabDef<EditorTab>[] = [
  { id: 'edit', label: 'Editar' },
  { id: 'preview', label: 'Vista previa' },
];

function VersionEditorModal({
  documentId,
  version,
  onClose,
}: {
  documentId: string;
  /** null = crear una nueva; si viene, es un borrador que se edita. */
  version: TermsVersionRow | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const createVersion = useCreateTermsVersion(documentId);
  const updateVersion = useUpdateTermsVersion();

  const [label, setLabel] = useState(version?.version ?? '');
  const [title, setTitle] = useState(version?.title ?? '');
  const [body, setBody] = useState(version?.body ?? '');
  const [tab, setTab] = useState<EditorTab>('edit');
  const [error, setError] = useState<string | null>(null);

  const pending = createVersion.isPending || updateVersion.isPending;

  const submit = (publish: boolean) => {
    const input: TermsVersionInput = {
      version: label.trim(),
      title: title.trim(),
      body: body.trim(),
      publish,
    };
    if (!input.version) return setError('La etiqueta de versión es obligatoria.');
    if (!input.title) return setError('El título es obligatorio.');
    if (!input.body) return setError('El contenido es obligatorio.');

    const onSuccess = () => {
      toast.success(publish ? 'Versión publicada.' : 'Borrador guardado.');
      onClose();
    };
    const onError = (err: unknown) => setError(getApiErrorMessage(err));

    if (version) {
      updateVersion.mutate(
        { id: version.id, version: input.version, title: input.title, body: input.body },
        { onSuccess, onError },
      );
    } else {
      createVersion.mutate(input, { onSuccess, onError });
    }
  };

  // Un solo editor y una sola vista previa en el DOM: en móvil se alterna con las
  // pestañas y en `lg` se ven en paralelo. Duplicar el <textarea> por breakpoint
  // crearía dos campos con la misma etiqueta.
  const paneClass = (own: EditorTab) =>
    `min-w-0 ${tab === own ? '' : 'hidden lg:block'}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={version ? `Editar borrador ${version.version}` : 'Nueva versión'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={pending}>
            Guardar borrador
          </Button>
          {/* Editar un borrador no lo publica: para eso está la acción de la lista. */}
          {!version && (
            <Button onClick={() => submit(true)} disabled={pending}>
              Publicar
            </Button>
          )}
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Etiqueta de versión"
            placeholder="1.0 · 2026-02"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setError(null);
            }}
          />
          <Input
            label="Título"
            placeholder="Condiciones de préstamo del kit"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
          />
        </div>

        {/* Móvil: pestañas Editar / Vista previa. Desktop (lg): dos columnas. */}
        <div className="lg:hidden">
          <Tabs tabs={EDITOR_TABS} active={tab} onChange={setTab} />
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className={paneClass('edit')}>
            <Textarea
              label="Contenido (Markdown)"
              rows={16}
              className="font-mono text-xs"
              placeholder={'# Título\n\nPárrafo con **negrita**.\n\n- Punto uno\n- Punto dos'}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className={paneClass('preview')}>
            <span className="text-sm font-semibold text-text-secondary">Vista previa</span>
            <div className="mt-1 max-h-[26rem] min-w-0 overflow-y-auto rounded-[var(--radius)] border border-border bg-surface-card p-3">
              {body.trim() ? (
                <Markdown>{body}</Markdown>
              ) : (
                <p className="text-sm text-text-muted">Escribe algo para ver la vista previa.</p>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-text-secondary">
          Se admite Markdown simple: <code># encabezados</code>, <code>**negrita**</code>,
          listas y citas. El HTML se muestra como texto, no se interpreta.
        </p>

        {error && <p className="break-words text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
