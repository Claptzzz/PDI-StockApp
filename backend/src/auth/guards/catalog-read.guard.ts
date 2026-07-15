import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../interfaces/auth.types';

/**
 * Lectura del catálogo (componentes / plantillas): permite ADMIN, PROFESSOR, o
 * cualquier usuario que sea ayudante activo en al menos un curso.
 */
@Injectable()
export class CatalogReadGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (user.role === Role.ADMIN || user.role === Role.PROFESSOR) {
      return true;
    }

    const assistant = await this.prisma.courseAssistant.findFirst({
      where: { assistantId: user.id, active: true },
      select: { id: true },
    });
    if (assistant) {
      return true;
    }

    throw new ForbiddenException('Sin acceso al catálogo');
  }
}
