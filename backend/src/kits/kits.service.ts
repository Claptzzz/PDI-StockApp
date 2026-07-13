import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KitStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { StockService } from '../components/stock.service';
import { AssignKitDto } from './dto/assign-kit.dto';

interface DesiredItem {
  componentId: string;
  quantity: number;
}

@Injectable()
export class KitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
    private readonly stock: StockService,
  ) {}

  async assign(courseId: string, groupId: string, dto: AssignKitDto) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);

    const hasTemplate = dto.templateId !== undefined && dto.templateId !== null;
    const hasItems = Array.isArray(dto.items) && dto.items.length > 0;
    if (hasTemplate === hasItems) {
      throw new BadRequestException('Debes enviar exactamente uno de: templateId o items');
    }

    const code = dto.code.trim();
    if (!code) {
      throw new BadRequestException('El code no puede estar vacío');
    }

    const desired = hasTemplate
      ? await this.itemsFromTemplate(dto.templateId!)
      : await this.itemsFromInput(dto.items!);

    const componentIds = desired.map((d) => d.componentId);
    const components = await this.prisma.component.findMany({
      where: { id: { in: componentIds } },
      select: { id: true, name: true, totalStock: true },
    });
    const byId = new Map(components.map((c) => [c.id, c]));

    try {
      const kit = await this.prisma.$transaction(async (tx) => {
        // Validación de stock dentro de la transacción (foto consistente).
        const commitments = await this.stock.getCommitments(componentIds, tx);
        const shortages = desired
          .map((d) => {
            const comp = byId.get(d.componentId)!;
            const commitment = commitments.get(d.componentId) ?? { inKits: 0, inLoans: 0 };
            const available = this.stock.available(comp.totalStock, commitment);
            return {
              componentId: d.componentId,
              name: comp.name,
              requested: d.quantity,
              available,
            };
          })
          .filter((s) => s.available < s.requested);

        if (shortages.length > 0) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Stock insuficiente para asignar el kit',
            shortages,
          });
        }

        return tx.kit.create({
          data: {
            code,
            courseId,
            groupId,
            templateId: hasTemplate ? dto.templateId : null,
            status: KitStatus.ASSIGNED,
            items: {
              create: desired.map((d) => ({
                componentId: d.componentId,
                componentName: byId.get(d.componentId)!.name,
                quantity: d.quantity,
                returnedQuantity: 0,
              })),
            },
          },
        });
      });

      return this.getKitDetail(kit.id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un kit con ese code en este curso');
      }
      throw error;
    }
  }

  async listByGroup(courseId: string, groupId: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);

    const kits = await this.prisma.kit.findMany({
      where: { groupId },
      include: {
        _count: { select: { items: true } },
        items: { orderBy: { componentName: 'asc' } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return kits.map((kit) => ({
      id: kit.id,
      code: kit.code,
      status: kit.status,
      templateId: kit.templateId,
      assignedAt: kit.assignedAt,
      returnedAt: kit.returnedAt,
      itemCount: kit._count.items,
      items: kit.items.map((it) => ({
        id: it.id,
        componentId: it.componentId,
        componentName: it.componentName,
        quantity: it.quantity,
        returnedQuantity: it.returnedQuantity,
        pending: it.quantity - it.returnedQuantity,
      })),
    }));
  }

  async getOne(courseId: string, groupId: string, kitId: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    await this.assertKitInGroup(kitId, groupId);
    return this.getKitDetail(kitId);
  }

  async listByCourse(courseId: string) {
    const kits = await this.prisma.kit.findMany({
      where: { courseId },
      include: {
        _count: { select: { items: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return kits.map((kit) => ({
      id: kit.id,
      code: kit.code,
      status: kit.status,
      group: kit.group,
      assignedAt: kit.assignedAt,
      itemCount: kit._count.items,
    }));
  }

  async updateCode(courseId: string, groupId: string, kitId: string, rawCode: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    await this.assertKitInGroup(kitId, groupId);

    const code = rawCode.trim();
    if (!code) {
      throw new BadRequestException('El code no puede estar vacío');
    }

    try {
      await this.prisma.kit.update({ where: { id: kitId }, data: { code } });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un kit con ese code en este curso');
      }
      throw error;
    }

    return this.getKitDetail(kitId);
  }

  async remove(courseId: string, groupId: string, kitId: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    await this.assertKitInGroup(kitId, groupId);

    await this.prisma.kit.delete({ where: { id: kitId } });
    return { deleted: true };
  }

  // --- Helpers -----------------------------------------------------------

  private async itemsFromTemplate(templateId: string): Promise<DesiredItem[]> {
    const template = await this.prisma.kitTemplate.findUnique({
      where: { id: templateId },
      include: { items: true },
    });
    if (!template) {
      throw new BadRequestException('El template no existe');
    }
    if (template.items.length === 0) {
      throw new BadRequestException('El template no tiene items');
    }
    return template.items.map((it) => ({ componentId: it.componentId, quantity: it.quantity }));
  }

  private async itemsFromInput(items: DesiredItem[]): Promise<DesiredItem[]> {
    const ids = items.map((i) => i.componentId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay componentId duplicados en items');
    }

    const found = await this.prisma.component.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      const foundSet = new Set(found.map((c) => c.id));
      const missing = ids.filter((id) => !foundSet.has(id));
      throw new BadRequestException(`Componentes inexistentes: ${missing.join(', ')}`);
    }

    return items.map((i) => ({ componentId: i.componentId, quantity: i.quantity }));
  }

  /** Verifica que el kit exista y pertenezca al grupo indicado (404 si no). */
  private async assertKitInGroup(kitId: string, groupId: string): Promise<void> {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      select: { groupId: true },
    });
    if (!kit || kit.groupId !== groupId) {
      throw new NotFoundException('Kit no encontrado en este grupo');
    }
  }

  private async getKitDetail(kitId: string) {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: {
        _count: { select: { items: true } },
        items: { orderBy: { componentName: 'asc' } },
      },
    });
    if (!kit) {
      throw new NotFoundException('Kit no encontrado');
    }

    return {
      id: kit.id,
      code: kit.code,
      status: kit.status,
      courseId: kit.courseId,
      groupId: kit.groupId,
      templateId: kit.templateId,
      assignedAt: kit.assignedAt,
      returnedAt: kit.returnedAt,
      itemCount: kit._count.items,
      items: kit.items.map((it) => ({
        id: it.id,
        componentId: it.componentId,
        componentName: it.componentName,
        quantity: it.quantity,
        returnedQuantity: it.returnedQuantity,
        pending: it.quantity - it.returnedQuantity,
      })),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
