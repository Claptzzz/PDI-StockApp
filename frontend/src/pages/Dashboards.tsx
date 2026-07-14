import { useAuth } from '@/store/auth';
import { roleLabel } from '@/lib/types';

function Placeholder({ title }: { title: string }) {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-text-primary">{title}</h1>
      {user && (
        <p className="mt-2 text-text-secondary">
          Sesión iniciada como <strong className="text-text-primary">{user.name}</strong> · rol{' '}
          <strong className="text-text-primary">{roleLabel[user.role]}</strong>
        </p>
      )}
      <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface-card p-6">
        <p className="font-semibold text-text-primary">Vistas en construcción 🚧</p>
        <p className="mt-1 text-sm text-text-muted">
          Las funciones de gestión se habilitarán en las próximas fases.
        </p>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  return <Placeholder title="Panel de administración" />;
}

export function ProfesorDashboard() {
  return <Placeholder title="Panel del profesor" />;
}

export function EstudianteDashboard() {
  return <Placeholder title="Mi grupo" />;
}
