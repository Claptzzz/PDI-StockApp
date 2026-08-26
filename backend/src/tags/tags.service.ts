import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTagDto) {
    try {
      const tag = await this.prisma.tag.create({
        data: { name: dto.name, color: dto.color ?? null },
      });
      return { ...tag, componentsCount: 0 };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Ya existe una etiqueta llamada "${dto.name}"`);
      }
      throw error;
    }
  }

  /** Lista de etiquetas con el conteo de componentes asociados (una sola query). */
  async list() {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { components: true } } },
    });

    return tags.map(({ _count, ...tag }) => ({
      ...tag,
      componentsCount: _count.components,
    }));
  }

  async update(id: string, dto: UpdateTagDto) {
    const existing = await this.prisma.tag.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException('Etiqueta no encontrada');
    }

    try {
      const tag = await this.prisma.tag.update({
        where: { id },
        // `color: null` limpia el color; `undefined` lo deja intacto.
        data: { name: dto.name, color: dto.color },
        include: { _count: { select: { components: true } } },
      });
      const { _count, ...rest } = tag;
      return { ...rest, componentsCount: _count.components };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Ya existe una etiqueta llamada "${dto.name}"`);
      }
      throw error;
    }
  }

  /**
   * Elimina la etiqueta. Los componentes NO se tocan: la tabla intermedia
   * (_ComponentToTag) tiene ON DELETE CASCADE, así que solo se desasocian.
   */
  async remove(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { components: true } } },
    });
    if (!tag) {
      throw new NotFoundException('Etiqueta no encontrada');
    }

    await this.prisma.tag.delete({ where: { id } });
    return { deleted: true, detachedComponents: tag._count.components };
  }

  /**
   * Valida que todos los ids existan y devuelve el set normalizado (sin duplicados).
   * Lanza 400 si alguno no existe.
   */
  async assertTagsExist(tagIds: string[]): Promise<string[]> {
    const unique = [...new Set(tagIds)];
    if (unique.length === 0) return [];

    const found = await this.prisma.tag.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      const foundIds = new Set(found.map((t) => t.id));
      const missing = unique.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Etiqueta(s) inexistente(s): ${missing.join(', ')}`);
    }
    return unique;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
