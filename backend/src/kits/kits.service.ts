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
import {
  ReturnEventsService,
  RETURN_EVENT_SELECT,
  hasReturnNotes,
} from '../returns/return-events.service';
import { AssignKitDto } from './dto/assign-kit.dto';

/**
 * Hay discrepancia si, ya verificado el kit, algún ítem quedó sin marcar o trae nota.
 * Antes de verificar todos los `verified` son false por defecto, así que no cuenta.
 */
function hasDiscrepancies(
  verifiedAt: Date | null,
  items: { verified: boolean; verificationNote: string | null }[],
): boolean {
  if (verifiedAt === null) return false;
  return items.some((it) => !it.verified || it.verificationNote !== null);
}

/** Flags resumidos para destacar el kit en los listados del profesor/ayudante. */
function summaryFlags(
  verifiedAt: Date | null,
  items: { verified: boolean; verificationNote: string | null }[],
  acceptedCount: number,
  memberCount: number,
) {
  return {
    isVerified: verifiedAt !== null,
    verifiedAt,
    hasDiscrepancies: hasDiscrepancies(verifiedAt, items),
    acceptanceStatus: `${acceptedCount}/${memberCount}`,
    allAccepted: memberCount > 0 && acceptedCount >= memberCount,
  };
}

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
    private readonly returnEvents: ReturnEventsService,
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
        _count: { select: { items: true, acceptances: true } },
        items: { orderBy: { componentName: 'asc' } },
        group: { select: { _count: { select: { members: true } } } },
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
        verified: it.verified,
        verificationNote: it.verificationNote,
      })),
      ...summaryFlags(kit.verifiedAt, kit.items, kit._count.acceptances, kit.group._count.members),
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
        _count: { select: { items: true, acceptances: true } },
        items: { select: { verified: true, verificationNote: true } },
        group: {
          select: { id: true, name: true, _count: { select: { members: true } } },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return kits.map((kit) => ({
      id: kit.id,
      code: kit.code,
      status: kit.status,
      group: { id: kit.group.id, name: kit.group.name },
      assignedAt: kit.assignedAt,
      itemCount: kit._count.items,
      ...summaryFlags(kit.verifiedAt, kit.items, kit._count.acceptances, kit.group._count.members),
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

  /**
   * Devolución granular de un ítem del snapshot del kit. Incrementa
   * returnedQuantity (<= pendiente) y, si TODOS los ítems quedan devueltos,
   * cierra el kit (status=RETURNED, returnedAt=now). Solo avanza.
   */
  async returnItem(
    courseId: string,
    groupId: string,
    kitId: string,
    kitItemId: string,
    quantity: number,
    receivedById: string,
    note?: string | null,
  ) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    await this.assertKitInGroup(kitId, groupId);

    const item = await this.prisma.kitItem.findUnique({ where: { id: kitItemId } });
    if (!item || item.kitId !== kitId) {
      throw new NotFoundException('Ítem no encontrado en este kit');
    }

    const pending = item.quantity - item.returnedQuantity;
    if (quantity > pending) {
      throw new BadRequestException(
        `No puedes devolver ${quantity}: solo hay ${pending} unidad(es) pendiente(s) de este ítem`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.kitItem.update({
        where: { id: kitItemId },
        data: { returnedQuantity: item.returnedQuantity + quantity },
      });

      // Mismo $transaction: el historial no puede divergir del contador.
      await this.returnEvents.record({ kitItemId, quantity, note, receivedById }, tx);

      const items = await tx.kitItem.findMany({
        where: { kitId },
        select: { quantity: true, returnedQuantity: true },
      });
      const allReturned = items.every((it) => it.returnedQuantity >= it.quantity);

      if (allReturned) {
        await tx.kit.update({
          where: { id: kitId },
          data: { status: KitStatus.RETURNED, returnedAt: new Date() },
        });
      }
    });

    return this.getKitDetail(kitId);
  }

  /** Resumen de devoluciones del grupo (kits + préstamos) para fin de semestre. */
  async returnsSummary(courseId: string, groupId: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);

    const eventsInclude = {
      returnEvents: { orderBy: { createdAt: 'asc' }, select: RETURN_EVENT_SELECT },
    } satisfies Prisma.KitItemInclude & Prisma.LoanInclude;

    const [kits, loans] = await Promise.all([
      this.prisma.kit.findMany({
        where: { groupId },
        include: { items: { orderBy: { componentName: 'asc' }, include: eventsInclude } },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.loan.findMany({
        where: { groupId },
        orderBy: { loanedAt: 'desc' },
        include: eventsInclude,
      }),
    ]);

    const kitSummaries = kits.map((kit) => {
      const items = kit.items.map((it) => ({
        kitItemId: it.id,
        componentName: it.componentName,
        quantity: it.quantity,
        returnedQuantity: it.returnedQuantity,
        pending: it.quantity - it.returnedQuantity,
        returnEvents: it.returnEvents,
        hasReturnNotes: hasReturnNotes(it.returnEvents),
      }));
      return {
        kitId: kit.id,
        code: kit.code,
        status: kit.status,
        allReturned: items.every((it) => it.pending === 0),
        // Para destacar el kit completo de un vistazo al cierre de semestre.
        hasReturnNotes: items.some((it) => it.hasReturnNotes),
        items,
      };
    });

    const loanSummaries = loans.map((loan) => ({
      loanId: loan.id,
      componentName: loan.componentName,
      quantity: loan.quantity,
      returnedQuantity: loan.returnedQuantity,
      pending: loan.quantity - loan.returnedQuantity,
      returnEvents: loan.returnEvents,
      hasReturnNotes: hasReturnNotes(loan.returnEvents),
    }));

    const allReturned =
      kitSummaries.every((k) => k.allReturned) && loanSummaries.every((l) => l.pending === 0);

    return { groupId, allReturned, kits: kitSummaries, loans: loanSummaries };
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
        items: {
          orderBy: { componentName: 'asc' },
          include: { returnEvents: { orderBy: { createdAt: 'asc' }, select: RETURN_EVENT_SELECT } },
        },
        verifiedBy: { select: { id: true, name: true } },
        acceptances: { select: { studentId: true, acceptedAt: true, termsVersion: true } },
        group: {
          select: {
            members: {
              select: { student: { select: { id: true, name: true } } },
              orderBy: { student: { name: 'asc' } },
            },
          },
        },
      },
    });
    if (!kit) {
      throw new NotFoundException('Kit no encontrado');
    }

    const acceptanceByStudent = new Map(kit.acceptances.map((a) => [a.studentId, a]));
    const members = kit.group.members.map((m) => {
      const acceptance = acceptanceByStudent.get(m.student.id);
      return {
        studentId: m.student.id,
        name: m.student.name,
        accepted: Boolean(acceptance),
        acceptedAt: acceptance?.acceptedAt ?? null,
      };
    });

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
        verified: it.verified,
        verificationNote: it.verificationNote,
        returnEvents: it.returnEvents,
        hasReturnNotes: hasReturnNotes(it.returnEvents),
      })),
      verifiedBy: kit.verifiedBy,
      // Mismos flags resumidos que los listados, para que el shape no diverja.
      ...summaryFlags(
        kit.verifiedAt,
        kit.items,
        members.filter((m) => m.accepted).length,
        members.length,
      ),
      acceptances: {
        accepted: members.filter((m) => m.accepted).length,
        total: members.length,
        pending: members.filter((m) => !m.accepted).map((m) => m.name),
        members,
      },
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
