import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Cliente Prisma o cliente de transacción (los eventos se crean dentro del $transaction). */
type PrismaClientLike = PrismaService | Prisma.TransactionClient;

/** `select` compartido: siempre exponemos el evento con quién recibió. */
export const RETURN_EVENT_SELECT = {
  id: true,
  quantity: true,
  note: true,
  createdAt: true,
  receivedBy: { select: { id: true, name: true } },
} satisfies Prisma.ReturnEventSelect;

export type ReturnEventResponse = Prisma.ReturnEventGetPayload<{
  select: typeof RETURN_EVENT_SELECT;
}>;

interface RecordArgs {
  /** Exactamente uno de kitItemId / loanId. */
  kitItemId?: string;
  loanId?: string;
  quantity: number;
  note?: string | null;
  receivedById: string;
}

/**
 * Historial de devoluciones. Como una devolución puede ser parcial y repetirse en el
 * tiempo, se guarda un EVENTO por registro (cantidad + nota + quién + cuándo) en vez de
 * una sola nota por ítem.
 */
@Injectable()
export class ReturnEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea el evento. Debe llamarse DENTRO de la misma transacción que incrementa
   * `returnedQuantity`, para que historial y contador no puedan divergir.
   */
  async record(args: RecordArgs, client: PrismaClientLike = this.prisma) {
    const hasKitItem = Boolean(args.kitItemId);
    const hasLoan = Boolean(args.loanId);
    // El schema no puede expresar este XOR (ambas FK son opcionales), así que se valida aquí.
    if (hasKitItem === hasLoan) {
      throw new BadRequestException(
        'Un ReturnEvent debe referenciar exactamente uno de: kitItemId o loanId',
      );
    }

    return client.returnEvent.create({
      data: {
        kitItemId: args.kitItemId ?? null,
        loanId: args.loanId ?? null,
        quantity: args.quantity,
        note: normalizeNote(args.note),
        receivedById: args.receivedById,
      },
      select: RETURN_EVENT_SELECT,
    });
  }

  /** Eventos de varios préstamos en una sola query (evita N+1 en los listados). */
  async byLoanIds(loanIds: string[]): Promise<Map<string, ReturnEventResponse[]>> {
    const result = new Map<string, ReturnEventResponse[]>();
    for (const id of loanIds) result.set(id, []);
    if (loanIds.length === 0) return result;

    const events = await this.prisma.returnEvent.findMany({
      where: { loanId: { in: loanIds } },
      orderBy: { createdAt: 'asc' },
      select: { ...RETURN_EVENT_SELECT, loanId: true },
    });

    for (const { loanId, ...event } of events) {
      if (loanId) result.get(loanId)?.push(event);
    }
    return result;
  }
}

/** Trim; cadena vacía → null. */
export function normalizeNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

/** true si algún evento del historial trae observación. */
export function hasReturnNotes(events: { note: string | null }[]): boolean {
  return events.some((e) => e.note !== null);
}
