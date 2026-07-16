import { useState } from 'react';
import { useGroup, useAddMember, useRemoveMember } from '@/api/groups';
import { getApiErrorMessage } from '@/lib/errors';
import type { Member } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

export function MembersSection({
  courseId,
  groupId,
  canManage = true,
}: {
  courseId: string;
  groupId: string;
  canManage?: boolean;
}) {
  const toast = useToast();
  const group = useGroup(courseId, groupId);
  const addMember = useAddMember(courseId, groupId);
  const removeMember = useRemoveMember(courseId, groupId);

  const [email, setEmail] = useState('');
  const [removing, setRemoving] = useState<Member | null>(null);

  const submitAdd = () => {
    const value = email.trim().toLowerCase();
    if (!value) return;
    addMember.mutate(value, {
      onSuccess: () => {
        toast.success('Integrante agregado.');
        setEmail('');
      },
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  };

  const confirmRemove = () => {
    if (!removing) return;
    removeMember.mutate(removing.id, {
      onSuccess: () => {
        toast.success('Integrante quitado.');
        setRemoving(null);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
        setRemoving(null);
      },
    });
  };

  return (
    <div>
      {canManage && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Agregar integrante (correo @alumnos.ucn.cl)"
              placeholder="ana.torres@alumnos.ucn.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            />
          </div>
          <Button onClick={submitAdd} disabled={addMember.isPending}>
            Agregar
          </Button>
        </div>
      )}

      <div className={canManage ? 'mt-4' : ''}>
        {group.isLoading ? (
          <Loading />
        ) : group.isError ? (
          <ErrorState message={getApiErrorMessage(group.error)} />
        ) : group.data && group.data.members.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                {canManage && <Th className="text-right">Acción</Th>}
              </tr>
            </thead>
            <tbody>
              {group.data.members.map((m) => (
                <tr key={m.id}>
                  <Td className="font-semibold">{m.name}</Td>
                  <Td className="text-text-secondary">{m.email}</Td>
                  {canManage && (
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                        Quitar
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="Este grupo aún no tiene integrantes." />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Quitar integrante"
        message={removing ? `¿Quitar a ${removing.name} del grupo?` : ''}
        confirmLabel="Quitar"
        danger
        loading={removeMember.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
