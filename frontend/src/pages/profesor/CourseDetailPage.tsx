import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCourse } from '@/api/courses';
import {
  useGroups,
  useCreateGroup,
  useRenameGroup,
  useDeleteGroup,
  useImportGroups,
} from '@/api/groups';
import { getApiErrorMessage } from '@/lib/errors';
import type { Group, ImportReport } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SearchBar } from '@/components/ui/SearchBar';
import { MatchedMembers } from '@/components/ui/MatchedMembers';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';
import { useGroupSearch } from '@/hooks/useGroupSearch';
import { AssistantsSection } from './AssistantsSection';

export function CourseDetailPage() {
  const { courseId = '' } = useParams();
  const toast = useToast();
  const course = useCourse(courseId);
  const groupsQuery = useGroups(courseId);
  const createGroup = useCreateGroup(courseId);
  const renameGroup = useRenameGroup(courseId);
  const deleteGroup = useDeleteGroup(courseId);
  const importGroups = useImportGroups(courseId);
  const search = useGroupSearch(groupsQuery.data);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setFormError(null);
    setFormOpen(true);
  };

  const openRename = (g: Group) => {
    setEditing(g);
    setName(g.name);
    setFormError(null);
    setFormOpen(true);
  };

  const submit = () => {
    const value = name.trim();
    if (!value) return setFormError('El nombre es obligatorio.');
    const onError = (err: unknown) => setFormError(getApiErrorMessage(err));
    if (editing) {
      renameGroup.mutate(
        { groupId: editing.id, name: value },
        {
          onSuccess: () => {
            toast.success('Grupo renombrado.');
            setFormOpen(false);
          },
          onError,
        },
      );
    } else {
      createGroup.mutate(value, {
        onSuccess: () => {
          toast.success('Grupo creado.');
          setFormOpen(false);
        },
        onError,
      });
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteGroup.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Grupo eliminado.');
        setDeleting(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setDeleting(null);
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/profesor/cursos" className="text-sm text-primary hover:underline">
        ← Volver a mis cursos
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">{course.data?.name ?? 'Curso'}</h1>
          {course.data && (
            <p className="mt-1 text-text-secondary">
              {course.data.year}/{course.data.semester === 1 ? '01' : '02'} · Grupos
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Importar CSV
          </Button>
          <Button onClick={openCreate}>Nuevo grupo</Button>
        </div>
      </div>

      <div className="mt-6">
        {groupsQuery.isLoading ? (
          <Loading />
        ) : groupsQuery.isError ? (
          <ErrorState message={getApiErrorMessage(groupsQuery.error)} />
        ) : groupsQuery.data && groupsQuery.data.length > 0 ? (
          <>
            <SearchBar
              value={search.query}
              onValueChange={search.setQuery}
              placeholder="Buscar equipo por nombre o integrante…"
              hint={search.hint}
              aria-label="Buscar equipo"
            />

            {search.matches.length === 0 ? (
              <div className="mt-4">
                <EmptyState message="Ningún equipo coincide con la búsqueda." />
              </div>
            ) : (
              <div className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Grupo</Th>
                      <Th>Integrantes</Th>
                      <Th className="text-right">Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {search.matches.map(({ group: g, matchedMembers }) => (
                      <tr key={g.id}>
                        <Td>
                          <span className="font-semibold">{g.name}</span>
                          <MatchedMembers members={matchedMembers} />
                        </Td>
                        <Td>{g.membersCount}</Td>
                        <Td className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link to={`/profesor/cursos/${courseId}/grupos/${g.id}`}>
                              <Button size="sm" variant="secondary">
                                Entrar
                              </Button>
                            </Link>
                            <Button size="sm" variant="ghost" onClick={() => openRename(g)}>
                              Renombrar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(g)}>
                              Eliminar
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        ) : (
          <EmptyState message="Aún no hay grupos. Crea uno o importa un CSV." />
        )}
      </div>

      <AssistantsSection courseId={courseId} />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Renombrar grupo' : 'Nuevo grupo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={createGroup.isPending || renameGroup.isPending}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Nombre del grupo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ingeniosos"
          />
          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Modal>

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        importFn={importGroups}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar grupo"
        message={deleting ? `¿Eliminar el grupo "${deleting.name}" y sus integrantes?` : ''}
        confirmLabel="Eliminar"
        danger
        loading={deleteGroup.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function ImportCsvModal({
  open,
  onClose,
  importFn,
}: {
  open: boolean;
  onClose: () => void;
  importFn: ReturnType<typeof useImportGroups>;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const close = () => {
    setFile(null);
    setReport(null);
    onClose();
  };

  const submit = () => {
    if (!file) return;
    importFn.mutate(file, {
      onSuccess: (data) => {
        setReport(data);
        toast.success('Importación procesada.');
      },
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Importar grupos desde CSV"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {report ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!report && (
            <Button onClick={submit} disabled={!file || importFn.isPending}>
              {importFn.isPending ? 'Subiendo…' : 'Subir'}
            </Button>
          )}
        </>
      }
    >
      {report ? (
        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Filas" value={report.summary.totalRows} />
            <Stat label="Importados" value={report.summary.imported} tone="success" />
            <Stat label="Omitidos" value={report.summary.skipped} />
            <Stat label="Grupos creados" value={report.summary.groupsCreated} />
          </div>
          {report.createdGroups.length > 0 && (
            <p className="text-text-secondary">
              Grupos creados: <strong>{report.createdGroups.join(', ')}</strong>
            </p>
          )}
          {report.errors.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-danger">Filas con error</p>
              <div className="max-h-48 overflow-auto rounded-[var(--radius)] border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left text-text-secondary">
                      <th className="px-2 py-1">Fila</th>
                      <th className="px-2 py-1">Correo</th>
                      <th className="px-2 py-1">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errors.map((e, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1">{e.row}</td>
                        <td className="px-2 py-1">{e.email}</td>
                        <td className="px-2 py-1 text-danger">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Encabezado esperado: <code>nombre,apellido,correo,nombreGrupo</code>
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-text-secondary file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-text-on-primary"
          />
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' }) {
  return (
    <div className="rounded-[var(--radius)] border border-border px-3 py-2">
      <div className="text-xs text-text-secondary">{label}</div>
      <div
        className={`text-lg font-bold ${tone === 'success' ? 'text-success' : 'text-text-primary'}`}
      >
        {value}
      </div>
    </div>
  );
}
