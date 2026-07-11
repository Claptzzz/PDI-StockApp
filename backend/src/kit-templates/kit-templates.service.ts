import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKitTemplateDto } from './dto/create-kit-template.dto';
import { UpdateKitTemplateDto } from './dto/update-kit-template.dto';
import { KitTemplateItemDto } from './dto/kit-template-item.dto';

@Injectable()
export class KitTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateKitTemplateDto) {
    this.assertNoDuplicateComponents(dto.items);
    await this.assertComponentsExist(dto.items);

    let created: { id: string };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const template = await tx.kitTemplate.create({ data: { name: dto.name } });
        await tx.kitTemplateItem.createMany({
          data: dto.items.map((item) => ({
            templateId: template.id,
            componentId: item.componentId,
            quantity: item.quantity,
          })),
        });
        return template;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un template con ese nombre');
      }
      throw error;
    }

    return this.getById(created.id);
  }

  async list() {
    const templates = await this.prisma.kitTemplate.findMany({
      include: {
        _count: { select: { items: true } },
        items: {
          include: { component: { select: { id: true, name: true } } },
          orderBy: { component: { name: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt,
      itemCount: t._count.items,
      items: t.items.map((it) => ({ component: it.component, quantity: it.quantity })),
    }));
  }

  async getById(id: string) {
    const template = await this.prisma.kitTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true } },
        items: {
          include: { component: { select: { id: true, name: true } } },
          orderBy: { component: { name: 'asc' } },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template no encontrado');
    }

    return {
      id: template.id,
      name: template.name,
      createdAt: template.createdAt,
      itemCount: template._count.items,
      items: template.items.map((it) => ({ component: it.component, quantity: it.quantity })),
    };
  }

  async update(id: string, dto: UpdateKitTemplateDto) {
    await this.ensureExists(id);

    if (dto.items) {
      this.assertNoDuplicateComponents(dto.items);
      await this.assertComponentsExist(dto.items);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.name !== undefined) {
          await tx.kitTemplate.update({ where: { id }, data: { name: dto.name } });
        }
        if (dto.items) {
          // Reemplaza el set completo de items.
          await tx.kitTemplateItem.deleteMany({ where: { templateId: id } });
          await tx.kitTemplateItem.createMany({
            data: dto.items.map((item) => ({
              templateId: id,
              componentId: item.componentId,
              quantity: item.quantity,
            })),
          });
        }
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un template con ese nombre');
      }
      throw error;
    }

    return this.getById(id);
  }

  async remove(id: string) {
    await this.ensureExists(id);

    // Los kits ya asignados conservan su snapshot en KitItem; solo se desvincula
    // la referencia al template (templateId = null) y luego se borra el template
    // (sus KitTemplateItem caen por onDelete: Cascade).
    await this.prisma.$transaction([
      this.prisma.kit.updateMany({ where: { templateId: id }, data: { templateId: null } }),
      this.prisma.kitTemplate.delete({ where: { id } }),
    ]);

    return { deleted: true };
  }

  // --- Helpers -----------------------------------------------------------

  private assertNoDuplicateComponents(items: KitTemplateItemDto[]): void {
    const ids = items.map((i) => i.componentId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay componentId duplicados en items');
    }
  }

  private async assertComponentsExist(items: KitTemplateItemDto[]): Promise<void> {
    const ids = [...new Set(items.map((i) => i.componentId))];
    const found = await this.prisma.component.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      const foundSet = new Set(found.map((c) => c.id));
      const missing = ids.filter((id) => !foundSet.has(id));
      throw new BadRequestException(`Componentes inexistentes: ${missing.join(', ')}`);
    }
  }

  private async ensureExists(id: string): Promise<void> {
    const template = await this.prisma.kitTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException('Template no encontrado');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
