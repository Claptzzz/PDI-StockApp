import { Role } from '@prisma/client';

/** Contenido del JWT que emite la aplicación. */
export interface JwtPayload {
  sub: string;
  email: string;
  /** Todos los roles del usuario (fuente de verdad de la autorización). */
  roles: Role[];
  /** Rol principal derivado; se mantiene por compatibilidad y para la UI. */
  role: Role;
}

/** Usuario autenticado que se adjunta a `request.user`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  /** Evalúa la autorización SIEMPRE contra este array, no contra `role`. */
  roles: Role[];
  role: Role;
}

/** true si el usuario tiene alguno de los roles indicados. */
export function hasRole(user: AuthenticatedUser, ...roles: Role[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}
