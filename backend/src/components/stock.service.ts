import { Injectable } from '@nestjs/common';
import { KitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Commitment {
  /** Unidades comprometidas en kits ASSIGNED (quantity - returnedQuantity). */
  inKits: number;
  /** Unidades comprometidas en préstamos vigentes (quantity - returnedQuantity). */
  inLoans: number;
}

/**
 * Cálculo de disponibilidad de componentes.
 *
 *   disponible = totalStock - inKits - inLoans
 *
 * - inKits: SUMA(quantity - returnedQuantity) de KitItem cuyos Kit.status = ASSIGNED.
 * - inLoans: SUMA(quantity - returnedQuantity) de Loan.
 *
 * Nota de diseño: el enunciado menciona "Loan.status = LOANED", pero el modelo Loan
 * (fijado en Fase 1) no tiene ese campo. Un préstamo devuelto tiene
 * returnedQuantity == quantity, por lo que aporta 0 a la suma; sumar
 * (quantity - returnedQuantity) sobre TODOS los loans es exactamente equivalente a
 * filtrar los "vigentes" sin necesidad de un campo status. (Ver reporte de la fase.)
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve, en lote y sin N+1 (2 agregaciones groupBy), las unidades comprometidas
   * por componente. Los componentes sin compromisos quedan en { inKits: 0, inLoans: 0 }.
   */
  async getCommitments(componentIds: string[]): Promise<Map<string, Commitment>> {
    const result = new Map<string, Commitment>();
    for (const id of componentIds) {
      result.set(id, { inKits: 0, inLoans: 0 });
    }
    if (componentIds.length === 0) {
      return result;
    }

    const [kitAgg, loanAgg] = await Promise.all([
      this.prisma.kitItem.groupBy({
        by: ['componentId'],
        where: { componentId: { in: componentIds }, kit: { status: KitStatus.ASSIGNED } },
        _sum: { quantity: true, returnedQuantity: true },
      }),
      this.prisma.loan.groupBy({
        by: ['componentId'],
        where: { componentId: { in: componentIds } },
        _sum: { quantity: true, returnedQuantity: true },
      }),
    ]);

    for (const row of kitAgg) {
      if (!row.componentId) continue;
      const entry = result.get(row.componentId);
      if (entry) {
        entry.inKits = (row._sum.quantity ?? 0) - (row._sum.returnedQuantity ?? 0);
      }
    }

    for (const row of loanAgg) {
      if (!row.componentId) continue;
      const entry = result.get(row.componentId);
      if (entry) {
        entry.inLoans = (row._sum.quantity ?? 0) - (row._sum.returnedQuantity ?? 0);
      }
    }

    return result;
  }

  available(totalStock: number, commitment: Commitment): number {
    return totalStock - commitment.inKits - commitment.inLoans;
  }
}
