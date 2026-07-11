import { Role } from '@prisma/client';

/**
 * Deriva el rol de un usuario a partir del dominio de su correo institucional.
 *
 * - Correo presente en `adminEmails` (case-insensitive) → ADMIN (prioridad).
 * - `@alumnos.ucn.cl`                                    → STUDENT
 * - `@ucn.cl` o `@ce.ucn.cl`                             → PROFESSOR
 * - Cualquier otro dominio                              → `null` (no reconocido)
 *
 * Devuelve `null` cuando el dominio no es válido; quien lo llame decide el 403.
 */
export function resolveRole(email: string, adminEmails: string[]): Role | null {
  const normalized = email.trim().toLowerCase();

  const admins = adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(normalized)) {
    return Role.ADMIN;
  }

  if (normalized.endsWith('@alumnos.ucn.cl')) {
    return Role.STUDENT;
  }

  if (normalized.endsWith('@ucn.cl') || normalized.endsWith('@ce.ucn.cl')) {
    return Role.PROFESSOR;
  }

  return null;
}
