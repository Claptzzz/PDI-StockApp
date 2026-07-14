import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { ListUsersQueryDto } from './dto/list-users.query.dto';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      where.role = query.role;
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

  async setActive(currentUser: AuthenticatedUser, id: string, isActive: boolean) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Protege contra quedarse sin administradores.
    if (!isActive && target.role === Role.ADMIN) {
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
}
