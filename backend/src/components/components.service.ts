import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from './stock.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

@Injectable()
export class ComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async create(dto: CreateComponentDto) {
    try {
      return await this.prisma.component.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          totalStock: dto.totalStock,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un componente con ese nombre');
      }
      throw error;
    }
  }

  async list(search?: string) {
    const where: Prisma.ComponentWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    const components = await this.prisma.component.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const commitments = await this.stock.getCommitments(components.map((c) => c.id));

    return components.map((c) => {
      const commitment = commitments.get(c.id) ?? { inKits: 0, inLoans: 0 };
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        totalStock: c.totalStock,
        available: this.stock.available(c.totalStock, commitment),
      };
    });
  }

  async getById(id: string) {
    const component = await this.prisma.component.findUnique({ where: { id } });
    if (!component) {
      throw new NotFoundException('Componente no encontrado');
    }

    const commitment = (await this.stock.getCommitments([id])).get(id) ?? {
      inKits: 0,
      inLoans: 0,
    };

    return {
      id: component.id,
      name: component.name,
      description: component.description,
      totalStock: component.totalStock,
      available: this.stock.available(component.totalStock, commitment),
      inKits: commitment.inKits,
      inLoans: commitment.inLoans,
    };
  }

  async update(id: string, dto: UpdateComponentDto) {
    const component = await this.prisma.component.findUnique({ where: { id } });
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

    try {
      return await this.prisma.component.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          totalStock: dto.totalStock,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un componente con ese nombre');
      }
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

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
  }
}
