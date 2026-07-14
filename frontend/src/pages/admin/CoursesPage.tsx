import { useState } from 'react';
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useCourseProfessors,
  useAddProfessor,
  useSetProfessorAuthorized,
  useRemoveProfessor,
  type CourseInput,
} from '@/api/courses';
import { getApiErrorMessage } from '@/lib/errors';
import type { Course, CourseProfessor } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

interface CourseFormState {
  name: string;
  year: string;
  semester: string;
}

const emptyForm: CourseFormState = { name: '', year: '2026', semester: '1' };

export function CoursesPage() {
  const toast = useToast();
  const coursesQuery = useCourses();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();

  const [selected, setSelected] = useState<Course | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setForm({ name: course.name, year: String(course.year), semester: String(course.semester) });
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = () => {
    const name = form.name.trim();
    const year = Number(form.year);
    const semester = Number(form.semester);
    if (!name) return setFormError('El nombre es obligatorio.');
    if (!Number.isInteger(year) || year < 2020 || year > 2100)
      return setFormError('El año debe estar entre 2020 y 2100.');
    if (semester !== 1 && semester !== 2) return setFormError('El semestre debe ser 1 o 2.');

    const input: CourseInput = { name, year, semester };
    const onError = (err: unknown) => setFormError(getApiErrorMessage(err));
    if (editing) {
      updateCourse.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success('Curso actualizado.');
            setFormOpen(false);
          },
          onError,
        },
      );
    } else {
      createCourse.mutate(input, {
        onSuccess: () => {
          toast.success('Curso creado.');
          setFormOpen(false);
        },
        onError,
      });
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteCourse.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Curso eliminado.');
        if (selected?.id === deleting.id) setSelected(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Cursos</h1>
          <p className="mt-1 text-text-secondary">Gestiona cursos y sus profesores autorizados.</p>
        </div>
        <Button onClick={openCreate}>Nuevo curso</Button>
      </div>

      <div className="mt-6">
        {coursesQuery.isLoading ? (
          <Loading />
        ) : coursesQuery.isError ? (
          <ErrorState message={getApiErrorMessage(coursesQuery.error)} />
        ) : coursesQuery.data && coursesQuery.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Curso</Th>
                <Th>Periodo</Th>
                <Th>Grupos</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {coursesQuery.data.map((course) => (
                <tr
                  key={course.id}
                  className={selected?.id === course.id ? 'bg-primary/5' : undefined}
                >
                  <Td className="font-semibold">{course.name}</Td>
                  <Td className="text-text-secondary">
                    {course.year}/{course.semester === 1 ? '01' : '02'}
                  </Td>
                  <Td>{course.groupsCount}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(course)}>
                        Profesores
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(course)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(course)}>
                        Eliminar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Aún no hay cursos. Crea el primero." />
        )}
      </div>

      {selected && <ProfessorsPanel course={selected} onClose={() => setSelected(null)} />}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar curso' : 'Nuevo curso'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submitForm}
              disabled={createCourse.isPending || updateCourse.isPending}
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
            placeholder="Proyecto de Diseño e Innovación"
          />
          <div className="flex gap-3">
            <Input
              label="Año"
              type="number"
              className="w-32"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
            <Select
              label="Semestre"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </Select>
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar curso"
        message={
          deleting
            ? `¿Eliminar "${deleting.name}" (${deleting.year}/${deleting.semester})? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleteCourse.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function ProfessorsPanel({ course, onClose }: { course: Course; onClose: () => void }) {
  const toast = useToast();
  const query = useCourseProfessors(course.id);
  const addProfessor = useAddProfessor(course.id);
  const setAuthorized = useSetProfessorAuthorized(course.id);
  const removeProfessor = useRemoveProfessor(course.id);

  const [email, setEmail] = useState('');
  const [removing, setRemoving] = useState<CourseProfessor | null>(null);

  const submitAdd = () => {
    const value = email.trim().toLowerCase();
    if (!value) return;
    addProfessor.mutate(value, {
      onSuccess: () => {
        toast.success('Profesor agregado.');
        setEmail('');
      },
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  };

  const toggle = (cp: CourseProfessor) => {
    setAuthorized.mutate(
      { professorId: cp.professorId, authorized: !cp.authorized },
      {
        onSuccess: () =>
          toast.success(cp.authorized ? 'Autorización retirada.' : 'Profesor autorizado.'),
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  const confirmRemove = () => {
    if (!removing) return;
    removeProfessor.mutate(removing.professorId, {
      onSuccess: () => {
        toast.success('Profesor quitado del curso.');
        setRemoving(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setRemoving(null);
      },
    });
  };

  return (
    <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Profesores · <span className="text-text-secondary">{course.name}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-text-muted hover:text-text-primary"
        >
          Cerrar
        </button>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Agregar profesor (correo institucional)"
            placeholder="profesor@ucn.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
          />
        </div>
        <Button onClick={submitAdd} disabled={addProfessor.isPending}>
          Agregar
        </Button>
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
                <Th>Profesor</Th>
                <Th>Correo</Th>
                <Th>Autorizado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((cp) => (
                <tr key={cp.professorId}>
                  <Td className="font-semibold">{cp.professor.name}</Td>
                  <Td className="text-text-secondary">{cp.professor.email}</Td>
                  <Td>
                    <Badge tone={cp.authorized ? 'success' : 'gray'}>
                      {cp.authorized ? 'Sí' : 'No'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant={cp.authorized ? 'secondary' : 'primary'}
                        onClick={() => toggle(cp)}
                        disabled={setAuthorized.isPending}
                      >
                        {cp.authorized ? 'Quitar acceso' : 'Autorizar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(cp)}>
                        Quitar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Este curso aún no tiene profesores asignados." />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Quitar profesor"
        message={removing ? `¿Quitar a ${removing.professor.name} de "${course.name}"?` : ''}
        confirmLabel="Quitar"
        danger
        loading={removeProfessor.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
