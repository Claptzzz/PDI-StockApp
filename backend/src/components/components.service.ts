import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TagsService } from '../tags/tags.service';
import { StockService } from './stock.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';
import { ListComponentsQueryDto } from './dto/list-components.query.dto';

/** Selección compartida: siempre devolvemos code + tags junto al componente. */
const COMPONENT_SELECT = {
  id: true,
  name: true,
  code: true,
  description: true,
  totalStock: true,
  tags: {
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.ComponentSelect;

@Injectable()
export class ComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly tags: TagsService,
  ) {}

  async create(dto: CreateComponentDto) {
    const tagIds = dto.tagIds ? await this.tags.assertTagsExist(dto.tagIds) : [];

    try {
      return await this.prisma.component.create({
        data: {
          name: dto.name,
          code: dto.code ?? null,
          description: dto.description ?? null,
          totalStock: dto.totalStock,
          tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
        },
        select: COMPONENT_SELECT,
      });
    } catch (error) {
      this.rethrowUniqueViolation(error, dto.code ?? null);
      throw error;
    }
  }

  async list(query: ListComponentsQueryDto = {}) {
    const where = this.buildWhere(query);

    const components = await this.prisma.component.findMany({
      where,
      orderBy: { name: 'asc' },
      select: COMPONENT_SELECT,
    });

    const commitments = await this.stock.getCommitments(components.map((c) => c.id));

    return components.map((c) => {
      const commitment = commitments.get(c.id) ?? { inKits: 0, inLoans: 0 };
      return { ...c, available: this.stock.available(c.totalStock, commitment) };
    });
  }

  async getById(id: string) {
    const component = await this.prisma.component.findUnique({
      where: { id },
      select: COMPONENT_SELECT,
    });
    if (!component) {
      throw new NotFoundException('Componente no encontrado');
    }

    const commitment = (await this.stock.getCommitments([id])).get(id) ?? {
      inKits: 0,
      inLoans: 0,
    };

    return {
      ...component,
      available: this.stock.available(component.totalStock, commitment),
      inKits: commitment.inKits,
      inLoans: commitment.inLoans,
    };
  }

  async update(id: string, dto: UpdateComponentDto) {
    const component = await this.prisma.component.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!component) {
      throw new NotFoundException('Componente no encontrado');
    }

    if (dto.totalStock !== undefined) {
      const commitment = (await this.stock.getCommitments([id])).get(id) ?? {
        inKits: 0,
        inLoans: 0,
      };
      const committed = commitment.inKits + commitment.inLoans;
      if (dto.totalStock < committed) {
        throw new BadRequestException(
          `No puedes fijar totalStock=${dto.totalStock}: hay ${committed} unidades comprometidas ` +
            `(en kits: ${commitment.inKits}, en préstamos: ${commitment.inLoans})`,
        );
      }
    }

    // `tagIds` reemplaza el set completo: `set` desconecta lo que no venga en la lista.
    const tagIds = dto.tagIds ? await this.tags.assertTagsExist(dto.tagIds) : undefined;

    try {
      return await this.prisma.component.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
          totalStock: dto.totalStock,
          tags: tagIds ? { set: tagIds.map((tagId) => ({ id: tagId })) } : undefined,
        },
        select: COMPONENT_SELECT,
      });
    } catch (error) {
      this.rethrowUniqueViolation(error, dto.code ?? null);
      throw error;
    }
  }

  async remove(id: string) {
    const component = await this.prisma.component.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!component) {
      throw new NotFoundException('Componente no encontrado');
    }

    try {
      await this.prisma.component.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Componente en uso (referenciado por templates, kits o préstamos); no se puede eliminar',
        );
      }
      throw error;
    }
  }

  /**
   * `search` busca en nombre O código; `tagId`/`tagIds` filtran por etiqueta
   * (OR entre etiquetas: basta con tener una de las seleccionadas).
   */
  private buildWhere(query: ListComponentsQueryDto): Prisma.ComponentWhereInput {
    const where: Prisma.ComponentWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const tagIds = [...new Set([...(query.tagId ?? []), ...(query.tagIds ?? [])])];
    if (tagIds.length > 0) {
      where.tags = { some: { id: { in: tagIds } } };
    }

    return where;
  }

  /** Traduce el P2002 de Postgres al campo real que chocó (name o code). */
  private rethrowUniqueViolation(error: unknown, code: string | null): never | void {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return;
    }
    // `meta.target` en Postgres es el listado de columnas del índice único.
    const target: unknown = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.map((f) => String(f))
      : typeof target === 'string'
        ? [target]
        : [];

    if (fields.some((f) => f.includes('code'))) {
      throw new ConflictException(
        `El código "${code ?? ''}" ya está asignado a otro componente; usa uno distinto`,
      );
    }
    throw new ConflictException('Ya existe un componente con ese nombre');
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
  }
}
