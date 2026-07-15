import { useState } from 'react';
import { useUsers, useSetUserActive } from '@/api/users';
import { getApiErrorMessage } from '@/lib/errors';
import { roleLabel, type Role } from '@/lib/types';
import type { UserAccount } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, Td, Th } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States';

const ROLE_TONE: Record<Role, BadgeTone> = {
  ADMIN: 'terracota',
  PROFESSOR: 'blue',
  STUDENT: 'gray',
};

export function AccountsPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [target, setTarget] = useState<UserAccount | null>(null);

  const toast = useToast();
  const query = useUsers({ search: search || undefined, role: role || undefined });
  const setActive = useSetUserActive();

  const confirmToggle = () => {
    if (!target) return;
    setActive.mutate(
      { id: target.id, isActive: !target.isActive },
      {
        onSuccess: () => {
          toast.success(`Cuenta ${target.isActive ? 'deshabilitada' : 'habilitada'}.`);
          setTarget(null);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
          setTarget(null);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-text-primary">Cuentas</h1>
      <p className="mt-1 text-text-secondary">Usuarios registrados en la plataforma.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            label="Buscar"
            placeholder="Nombre o correo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
            <option value="">Todos</option>
            <option value="ADMIN">Administrador</option>
            <option value="PROFESSOR">Profesor</option>
            <option value="STUDENT">Estudiante</option>
          </Select>
        </div>
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
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acción</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((u) => (
                <tr key={u.id}>
                  <Td className="font-semibold">{u.name}</Td>
                  <Td className="text-text-secondary">{u.email}</Td>
                  <Td>
                    <Badge tone={ROLE_TONE[u.role]}>{roleLabel[u.role]}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant={u.isActive ? 'secondary' : 'primary'}
                      onClick={() => setTarget(u)}
                    >
                      {u.isActive ? 'Deshabilitar' : 'Habilitar'}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="No hay usuarios que coincidan con el filtro." />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        title={target?.isActive ? 'Deshabilitar cuenta' : 'Habilitar cuenta'}
        message={
          target
            ? `¿Confirmas ${target.isActive ? 'deshabilitar' : 'habilitar'} la cuenta de ${target.name} (${target.email})?`
            : ''
        }
        confirmLabel={target?.isActive ? 'Deshabilitar' : 'Habilitar'}
        danger={target?.isActive}
        loading={setActive.isPending}
        onConfirm={confirmToggle}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
