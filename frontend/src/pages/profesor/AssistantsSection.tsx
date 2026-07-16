import { useState } from 'react';
import { useCourseAssistants, useSetAssistantActive, useRemoveAssistant } from '@/api/courses';
import { getApiErrorMessage } from '@/lib/errors';
import type { CourseAssistant } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AssistantPicker } from '@/components/ui/AssistantPicker';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

export function AssistantsSection({ courseId }: { courseId: string }) {
  const toast = useToast();
  const query = useCourseAssistants(courseId);
  const setActive = useSetAssistantActive(courseId);
  const removeAssistant = useRemoveAssistant(courseId);

  const [removing, setRemoving] = useState<CourseAssistant | null>(null);

  const toggle = (a: CourseAssistant) => {
    setActive.mutate(
      { assistantId: a.assistantId, active: !a.active },
      {
        onSuccess: () => toast.success(a.active ? 'Ayudante desactivado.' : 'Ayudante activado.'),
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  const confirmRemove = () => {
    if (!removing) return;
    removeAssistant.mutate(removing.assistantId, {
      onSuccess: () => {
        toast.success('Ayudante quitado.');
        setRemoving(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setRemoving(null);
      },
    });
  };

  return (
    <section className="mt-8 rounded-[var(--radius-card)] border border-border bg-surface-card p-5">
      <h2 className="text-lg font-semibold text-text-primary">Ayudantes</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Alumnos que pueden operar kits y préstamos de este curso (sin gestionar grupos).
      </p>

      <div className="mt-4">
        <AssistantPicker courseId={courseId} assigned={query.data ?? []} />
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
                <Th>Alumno</Th>
                <Th>Correo</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((a) => (
                <tr key={a.assistantId}>
                  <Td className="font-semibold">{a.assistant.name}</Td>
                  <Td className="text-text-secondary">{a.assistant.email}</Td>
                  <Td>
                    <Badge tone={a.active ? 'success' : 'gray'}>
                      {a.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant={a.active ? 'secondary' : 'primary'}
                        onClick={() => toggle(a)}
                        disabled={setActive.isPending}
                      >
                        {a.active ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(a)}>
                        Quitar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Este curso aún no tiene ayudantes." />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Quitar ayudante"
        message={removing ? `¿Quitar a ${removing.assistant.name} como ayudante?` : ''}
        confirmLabel="Quitar"
        danger
        loading={removeAssistant.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
