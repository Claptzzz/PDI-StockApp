import { Role } from '@prisma/client';

const normalize = (list: string[]): string[] =>
  list.map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Fuerza relativa de cada rol: ADMIN > PROFESSOR > STUDENT. */
const ROLE_RANK: Record<Role, number> = {
  [Role.STUDENT]: 1,
  [Role.PROFESSOR]: 2,
  [Role.ADMIN]: 3,
};

/** Ordena de mayor a menor privilegio (para mostrar y para elegir el principal). */
export function sortByPrivilege(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}

/** Rol principal = el de mayor privilegio presente. `null` si el array está vacío. */
export function primaryRole(roles: Role[]): Role | null {
  return sortByPrivilege(roles)[0] ?? null;
}

/** Une dos conjuntos de roles sin duplicados, ordenados por privilegio. */
export function unionRoles(...groups: Role[][]): Role[] {
  return sortByPrivilege([...new Set(groups.flat())]);
}

/**
 * Roles aplicables a un correo. Los allowlists son ADITIVOS: estar en ADMIN_EMAILS
 * AGREGA ADMIN sin quitar el rol que corresponda por dominio.
 *
 *   dominio @alumnos.ucn.cl      → STUDENT
 *   dominio @ucn.cl / @ce.ucn.cl → PROFESSOR
 *   email ∈ professorEmails      → + PROFESSOR (profes con correo no institucional)
 *   email ∈ adminEmails          → + ADMIN
 *
 * Array vacío = correo no reconocido; quien llama decide el 403.
 */
export function resolveRoles(
  email: string,
  adminEmails: string[],
  professorEmails: string[] = [],
): Role[] {
  const normalized = email.trim().toLowerCase();
  const roles = new Set<Role>();

  if (normalized.endsWith('@alumnos.ucn.cl')) {
    roles.add(Role.STUDENT);
  } else if (normalized.endsWith('@ucn.cl') || normalized.endsWith('@ce.ucn.cl')) {
    roles.add(Role.PROFESSOR);
  }

  if (normalize(professorEmails).includes(normalized)) {
    roles.add(Role.PROFESSOR);
  }
  if (normalize(adminEmails).includes(normalized)) {
    roles.add(Role.ADMIN);
  }

  return sortByPrivilege([...roles]);
}

/**
 * Rol principal aplicable a un correo. Se conserva por compatibilidad, pero para
 * preguntar "¿este correo es de un alumno/profesor?" usa `resolveRoles(...).includes(...)`:
 * con roles múltiples el principal ya no responde esa pregunta (un alumno que además
 * es admin tiene principal ADMIN y seguiría siendo alumno).
 */
export function resolveRole(
  email: string,
  adminEmails: string[],
  professorEmails: string[] = [],
): Role | null {
  return primaryRole(resolveRoles(email, adminEmails, professorEmails));
}
