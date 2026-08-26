import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { dashboardPath, hasAnyRole, primaryRole, userRoles, type Role } from '@/lib/types';

/**
 * Restringe una ruta a ciertos roles. Pasa si el usuario tiene ALGUNO de ellos
 * (un usuario con [STUDENT, ADMIN] entra tanto a /estudiante como a /admin/*).
 * Si no, lo manda al dashboard de su rol principal.
 */
export function RoleRoute({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyRole(user, roles)) {
    const home = primaryRole(userRoles(user));
    return <Navigate to={home ? dashboardPath(home) : '/login'} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
