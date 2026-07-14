import { Role } from '@prisma/client';

const normalize = (list: string[]): string[] =>
  list.map((e) => e.trim().toLowerCase()).filter(Boolean);

/**
 * Deriva el rol de un usuario a partir de los allowlists y del dominio del correo.
 * Precedencia (comparación case-insensitive):
 *   1º email ∈ adminEmails       → ADMIN
 *   2º email ∈ professorEmails   → PROFESSOR   (permite profes con correo no institucional)
 *   3º dominio @alumnos.ucn.cl   → STUDENT
 *   4º dominio @ucn.cl/@ce.ucn.cl→ PROFESSOR
 *   5º cualquier otro            → null (no reconocido; quien llama decide el 403)
 */
export function resolveRole(
  email: string,
  adminEmails: string[],
  professorEmails: string[] = [],
): Role | null {
  const normalized = email.trim().toLowerCase();

  if (normalize(adminEmails).includes(normalized)) {
    return Role.ADMIN;
  }

  if (normalize(professorEmails).includes(normalized)) {
    return Role.PROFESSOR;
  }

  if (normalized.endsWith('@alumnos.ucn.cl')) {
    return Role.STUDENT;
  }

  if (normalized.endsWith('@ucn.cl') || normalized.endsWith('@ce.ucn.cl')) {
    return Role.PROFESSOR;
  }

  return null;
}
