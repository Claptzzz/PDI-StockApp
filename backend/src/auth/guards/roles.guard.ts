import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../interfaces/auth.types';

/**
 * Pasa si el usuario TIENE ALGUNO de los roles exigidos por `@Roles`.
 * Se evalúa contra `user.roles` (fuente de verdad), no contra el rol principal:
 * un alumno que además es admin debe pasar por ambas puertas.
 * Si la ruta no declara roles, deja pasar.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    return !!user && requiredRoles.some((role) => user.roles.includes(role));
  }
}
