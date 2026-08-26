import { useState } from 'react';
import { useUsers, useSetUserActive, useSetUserRoles } from '@/api/users';
import { getApiErrorMessage } from '@/lib/errors';
import { roleLabel, sortByPrivilege, userRoles, type Role } from '@/lib/types';
import type { UserAccount } from '@/lib/apiTypes';
import { useToast } from '@/store/toast';
import { useAuth } from '@/store/auth';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Checkbox } from '@/components/ui/Checkbox';
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
  const [editingRoles, setEditingRoles] = useState<UserAccount | null>(null);

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
                <Th>Roles</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((u) => (
                <tr key={u.id}>
                  <Td className="font-semibold">{u.name}</Td>
                  <Td className="text-text-secondary">{u.email}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {userRoles(u).map((r) => (
                        <Badge key={r} tone={ROLE_TONE[r]}>
                          {roleLabel[r]}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditingRoles(u)}>
                        Editar roles
                      </Button>
                      <Button
                        size="sm"
                        variant={u.isActive ? 'ghost' : 'primary'}
                        onClick={() => setTarget(u)}
                      >
                        {u.isActive ? 'Deshabilitar' : 'Habilitar'}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="No hay usuarios que coincidan con el filtro." />
        )}
      </div>

      {editingRoles && (
        <EditRolesModal user={editingRoles} onClose={() => setEditingRoles(null)} />
      )}

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

// ----------------------------------------------------------------------------
// Edición de roles
// ----------------------------------------------------------------------------

const ALL_ROLES: Role[] = ['ADMIN', 'PROFESSOR', 'STUDENT'];

function EditRolesModal({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const toast = useToast();
  const setRoles = useSetUserRoles();
  const { user: me } = useAuth();

  const [selected, setSelected] = useState<Role[]>(userRoles(user));
  const [error, setError] = useState<string | null>(null);

  const isSelf = me?.id === user.id;
  const removingOwnAdmin = isSelf && userRoles(user).includes('ADMIN') && !selected.includes('ADMIN');

  const toggle = (role: Role) => {
    setError(null);
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : sortByPrivilege([...prev, role]),
    );
  };

  const submit = () => {
    if (selected.length === 0) {
      setError('El usuario debe tener al menos un rol.');
      return;
    }
    setRoles.mutate(
      { id: user.id, roles: selected },
      {
        onSuccess: () => {
          toast.success('Roles actualizados.');
          onClose();
        },
        // El backend rechaza quitarse ADMIN a uno mismo o dejar el sistema sin
        // administradores; su mensaje se muestra tal cual.
        onError: (err) => setError(getApiErrorMessage(err)),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar roles"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={setRoles.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={setRoles.isPending || selected.length === 0}>
            {setRoles.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <p className="break-words font-semibold text-text-primary">{user.name}</p>
          <p className="break-words text-sm text-text-secondary">{user.email}</p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-text-secondary">Roles</span>
          {ALL_ROLES.map((role) => (
            <Checkbox
              key={role}
              checked={selected.includes(role)}
              onChange={() => toggle(role)}
              label={roleLabel[role]}
            />
          ))}
        </div>

        <p className="text-xs text-text-secondary">
          Los roles se acumulan: un alumno puede ser además administrador. El rol principal
          (el de mayor privilegio) se recalcula solo.
        </p>

        {removingOwnAdmin && (
          <p className="rounded-[var(--radius)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ocre">
            Estás quitándote el rol de administrador a ti mismo: el sistema lo rechazará.
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
