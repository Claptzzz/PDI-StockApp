import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { dashboardPath, type Role } from '@/lib/types';

/**
 * Restringe una ruta a ciertos roles. Si el rol del usuario no está permitido,
 * lo redirige a su propio dashboard (no puede ver rutas de otro rol).
 */
export function RoleRoute({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={dashboardPath(user.role)} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
