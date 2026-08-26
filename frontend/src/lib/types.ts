export type Role = 'STUDENT' | 'PROFESSOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  /** Rol principal (mayor privilegio). Para autorizar usa `roles`. */
  role: Role;
  /** Todos los roles del usuario: fuente de verdad de qué puede ver y hacer. */
  roles: Role[];
}

/** Fuerza relativa: ADMIN > PROFESSOR > STUDENT. */
const ROLE_RANK: Record<Role, number> = { STUDENT: 1, PROFESSOR: 2, ADMIN: 3 };

/** Ordena de mayor a menor privilegio. */
export const sortByPrivilege = (roles: Role[]): Role[] =>
  [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);

/** Rol principal de una lista (el de mayor privilegio). */
export const primaryRole = (roles: Role[]): Role | null => sortByPrivilege(roles)[0] ?? null;

/**
 * Roles del usuario, tolerando sesiones viejas persistidas en localStorage que
 * solo guardaban `role` (el store se rehidrata sin pasar por el login).
 */
export const userRoles = (user: Pick<User, 'role' | 'roles'> | null | undefined): Role[] =>
  !user ? [] : user.roles?.length ? sortByPrivilege(user.roles) : [user.role];

/** true si el usuario tiene alguno de los roles indicados. */
export const hasAnyRole = (
  user: Pick<User, 'role' | 'roles'> | null | undefined,
  roles: Role[],
): boolean => {
  const owned = userRoles(user);
  return roles.some((r) => owned.includes(r));
};

/** Ruta del dashboard por defecto según el rol. */
export function dashboardPath(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'PROFESSOR':
      return '/profesor';
    case 'STUDENT':
      return '/estudiante';
  }
}

export const roleLabel: Record<Role, string> = {
  ADMIN: 'Administrador',
  PROFESSOR: 'Profesor',
  STUDENT: 'Estudiante',
};
