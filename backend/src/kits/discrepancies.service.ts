import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../components/stock.service';
import { itemHasDiscrepancy, type DiscrepancyAction } from './discrepancy.constants';
import { ResolveDiscrepancyDto } from './dto/resolve-discrepancy.dto';

/** `select` compartido: la resolución siempre viaja con quién la tomó. */
export const RESOLUTION_SELECT = {
  id: true,
  action: true,
  quantity: true,
  note: true,
  createdAt: true,
  resolvedBy: { select: { id: true, name: true } },
} satisfies Prisma.DiscrepancyResolutionSelect;

/**
 * Resolución de discrepancias reportadas por el alumno al verificar el kit.
 *
 * Cada acción deja un registro inmutable y, según el caso, ajusta la cantidad
 * exigida del kit o el stock del componente. Como la disponibilidad se CALCULA
 * (`available = totalStock − comprometido`), reducir `KitItem.quantity` libera el
 * compromiso solo; no hay contadores que tocar.
 */
@Injectable()
export class DiscrepanciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async resolve(
    kitId: string,
    kitItemId: string,
    dto: ResolveDiscrepancyDto,
    resolvedById: string,
  ) {
    const item = await this.prisma.kitItem.findUnique({
      where: { id: kitItemId },
      include: { kit: { select: { id: true, verifiedAt: true } } },
    });
    if (!item || item.kitId !== kitId) {
      throw new NotFoundException('Ítem no encontrado en este kit');
    }

    if (item.kit.verifiedAt === null) {
      throw new ConflictException(
        'El kit aún no ha sido verificado por el grupo: no hay discrepancias que resolver',
      );
    }
    if (!itemHasDiscrepancy(item)) {
      throw new ConflictException('Este ítem no tiene discrepancias que resolver');
    }
    if (dto.quantity > item.quantity) {
      throw new BadRequestException(
        `No puedes resolver ${dto.quantity} unidad(es): el ítem solo tiene ${item.quantity}`,
      );
    }
    if (dto.action === 'WRITE_OFF' && !item.componentId) {
      throw new BadRequestException(
        'Este ítem no está enlazado al catálogo, así que no se puede dar de baja del inventario',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.applyEffect(tx, item, dto);

      await tx.discrepancyResolution.create({
        data: {
          kitItemId,
          action: dto.action,
          quantity: dto.quantity,
          note: dto.note,
          resolvedById,
        },
      });
    });

    return this.getItem(kitItemId);
  }

  /** Efecto de cada acción sobre el kit y/o el inventario. */
  private async applyEffect(
    tx: Prisma.TransactionClient,
    item: { id: string; quantity: number; returnedQuantity: number; componentId: string | null },
    dto: ResolveDiscrepancyDto,
  ): Promise<void> {
    const action: DiscrepancyAction = dto.action;

    // Solo deja constancia: el ítem queda revisado, sin cambios.
    if (action === 'ACKNOWLEDGED') return;

    // Se repuso: el ítem vuelve a estar conforme y se le exigirá devolver el total.
    if (action === 'REPLACED') {
      await tx.kitItem.update({ where: { id: item.id }, data: { verified: true } });
      return;
    }

    // DEDUCTED y WRITE_OFF reducen la cantidad exigida del kit.
    // Nunca por debajo de lo ya devuelto (ni de 0): esas unidades sí están.
    const floor = Math.max(0, item.returnedQuantity);
    const nextQuantity = Math.max(floor, item.quantity - dto.quantity);

    if (action === 'WRITE_OFF') {
      await this.writeOffStock(tx, item.componentId!, dto.quantity);
    }

    await tx.kitItem.update({ where: { id: item.id }, data: { quantity: nextQuantity } });
  }

  /**
   * Baja de inventario: reduce `Component.totalStock`, nunca por debajo de lo que ya
   * está comprometido en kits y préstamos (dejaría la disponibilidad en negativo).
   */
  private async writeOffStock(
    tx: Prisma.TransactionClient,
    componentId: string,
    quantity: number,
  ): Promise<void> {
    const component = await tx.component.findUnique({
      where: { id: componentId },
      select: { id: true, name: true, totalStock: true },
    });
    if (!component) {
      throw new BadRequestException('El componente ya no existe en el catálogo');
    }

    // El compromiso se recalcula DENTRO de la transacción (foto consistente).
    const commitment = (await this.stock.getCommitments([componentId], tx)).get(componentId) ?? {
      inKits: 0,
      inLoans: 0,
    };
    const committed = commitment.inKits + commitment.inLoans;
    const nextTotal = component.totalStock - quantity;

    if (nextTotal < committed) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          `No puedes dar de baja ${quantity} unidad(es) de "${component.name}": el stock total ` +
          `quedaría en ${nextTotal} y hay ${committed} comprometida(s) ` +
          `(en kits: ${commitment.inKits}, en préstamos: ${commitment.inLoans})`,
        writeOff: {
          componentId: component.id,
          name: component.name,
          totalStock: component.totalStock,
          requested: quantity,
          committed,
        },
      });
    }

    await tx.component.update({ where: { id: componentId }, data: { totalStock: nextTotal } });
  }

  /** Ítem con su historial de resoluciones, para responder al cliente. */
  private async getItem(kitItemId: string) {
    const item = await this.prisma.kitItem.findUniqueOrThrow({
      where: { id: kitItemId },
      include: {
        resolutions: { orderBy: { createdAt: 'asc' }, select: RESOLUTION_SELECT },
      },
    });

    return {
      id: item.id,
      componentId: item.componentId,
      componentName: item.componentName,
      quantity: item.quantity,
      returnedQuantity: item.returnedQuantity,
      pending: item.quantity - item.returnedQuantity,
      verified: item.verified,
      verificationNote: item.verificationNote,
      resolutions: item.resolutions,
      isResolved: item.resolutions.length > 0,
    };
  }
}
