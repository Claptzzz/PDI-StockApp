import { Role } from '@prisma/client';

/** Contenido del JWT que emite la aplicación. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/** Usuario autenticado que se adjunta a `request.user`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}
