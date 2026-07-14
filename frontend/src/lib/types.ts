export type Role = 'STUDENT' | 'PROFESSOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

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
