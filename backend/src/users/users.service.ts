import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { primaryRole, sortByPrivilege } from '../auth/role.util';
import { ListUsersQueryDto } from './dto/list-users.query.dto';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  roles: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      // `has` sobre el array: un usuario con 2 roles aparece en ambos filtros.
      where.roles = { has: query.role };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  /** Busca alumnos por nombre/correo (top 10) para autocompletado. */
  async searchStudents(q: string) {
    const term = q.trim();
    return this.prisma.user.findMany({
      where: {
        roles: { has: Role.STUDENT },
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 10,
    });
  }

  async setActive(currentUser: AuthenticatedUser, id: string, isActive: boolean) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, roles: true },
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Protege contra quedarse sin administradores.
    if (!isActive && target.roles.includes(Role.ADMIN)) {
      if (target.id === currentUser.id) {
        throw new BadRequestException('No puedes deshabilitar tu propia cuenta');
      }
      throw new BadRequestException('No puedes deshabilitar a otro administrador');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: PUBLIC_SELECT,
    });
  }

  /**
   * Reemplaza el conjunto de roles de un usuario y recalcula el rol principal.
   *
   * Dos barreras contra dejar la plataforma sin administración:
   *  - un admin no puede quitarse ADMIN a sí mismo (se quedaría fuera al instante);
   *  - no puede desaparecer el último ADMIN activo del sistema.
   */
  async updateRoles(currentUser: AuthenticatedUser, id: string, roles: Role[]) {
    const nextRoles = sortByPrivilege([...new Set(roles)]);
    if (nextRoles.length === 0) {
      throw new BadRequestException('El usuario debe tener al menos un rol');
    }

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, roles: true, isActive: true },
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const losesAdmin = target.roles.includes(Role.ADMIN) && !nextRoles.includes(Role.ADMIN);

    if (losesAdmin) {
      if (target.id === currentUser.id) {
        throw new BadRequestException('No puedes quitarte a ti mismo el rol de administrador');
      }

      const otherAdmins = await this.prisma.user.count({
        where: { id: { not: id }, isActive: true, roles: { has: Role.ADMIN } },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException(
          'No puedes quitar el último administrador activo del sistema',
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { roles: nextRoles, role: primaryRole(nextRoles)! },
      select: PUBLIC_SELECT,
    });
  }
}
