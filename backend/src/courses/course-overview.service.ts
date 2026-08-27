import { Injectable, NotFoundException } from '@nestjs/common';
import { KitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Ítem de kit tal como lo necesitan los contadores de discrepancias. */
interface DiscrepancyItem {
  verified: boolean;
  verificationNote: string | null;
  _count: { resolutions: number };
}

const isDiscrepancy = (it: DiscrepancyItem): boolean =>
  !it.verified || it.verificationNote !== null;

/** Discrepancia que todavía nadie ha resuelto. */
const isPendingDiscrepancy = (it: DiscrepancyItem): boolean =>
  isDiscrepancy(it) && it._count.resolutions === 0;

/** Cuenta ítems que cumplen `match`, ignorando los kits aún sin verificar. */
function countDiscrepancies(
  kits: { verifiedAt: Date | null; items: DiscrepancyItem[] }[],
  match: (it: DiscrepancyItem) => boolean,
): number {
  return kits.reduce(
    (sum, kit) => (kit.verifiedAt === null ? sum : sum + kit.items.filter(match).length),
    0,
  );
}

/** Un integrante que aún no firma las condiciones. */
export interface PendingMember {
  id: string;
  name: string;
  email: string;
}

/**
 * Resumen agregado de TODO un curso, para que el profesor no tenga que abrir grupo
 * por grupo.
 *
 * Nota de rendimiento: se resuelve con un número CONSTANTE de queries (4), no una
 * por grupo. Los grupos pueden ser decenas y cada uno tiene kit, ítems, firmas y
 * préstamos; recorrerlos con consultas anidadas sería N+1. En su lugar se traen
 * cuatro colecciones filtradas por curso y se cruzan en memoria por id.
 */
@Injectable()
export class CourseOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, year: true, semester: true },
    });
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    // --- 4 consultas en paralelo, todas acotadas por curso ---------------
    const [groups, kits, loans, notedReturns] = await Promise.all([
      // 1) Grupos con sus integrantes.
      this.prisma.group.findMany({
        where: { courseId },
        select: {
          id: true,
          name: true,
          members: {
            select: { student: { select: { id: true, name: true, email: true } } },
            orderBy: { student: { name: 'asc' } },
          },
        },
        orderBy: { name: 'asc' },
      }),

      // 2) Kits del curso con sus ítems y firmas (no por grupo: de una vez).
      this.prisma.kit.findMany({
        where: { courseId },
        select: {
          id: true,
          code: true,
          groupId: true,
          status: true,
          verifiedAt: true,
          items: {
            select: {
              quantity: true,
              returnedQuantity: true,
              verified: true,
              verificationNote: true,
              // Una discrepancia con resolución registrada ya no está pendiente.
              _count: { select: { resolutions: true } },
            },
          },
          acceptances: { select: { studentId: true } },
        },
        orderBy: { assignedAt: 'desc' },
      }),

      // 3) Préstamos de todos los grupos del curso.
      this.prisma.loan.findMany({
        where: { group: { courseId } },
        select: { groupId: true, quantity: true, returnedQuantity: true },
      }),

      // 4) Solo los eventos de devolución CON nota, para el flag `hasReturnNotes`.
      //    Se piden los ids de grupo por las dos vías posibles (kit o préstamo).
      this.prisma.returnEvent.findMany({
        where: {
          note: { not: null },
          OR: [{ kitItem: { kit: { courseId } } }, { loan: { group: { courseId } } }],
        },
        select: {
          kitItem: { select: { kit: { select: { groupId: true } } } },
          loan: { select: { groupId: true } },
        },
      }),
    ]);

    // --- Índices en memoria ----------------------------------------------
    /** Un grupo puede tener varios kits; nos interesa el más reciente. */
    const kitByGroup = new Map<string, (typeof kits)[number]>();
    for (const kit of kits) {
      if (!kitByGroup.has(kit.groupId)) kitByGroup.set(kit.groupId, kit);
    }

    const loanPendingByGroup = new Map<string, number>();
    for (const loan of loans) {
      const pending = loan.quantity - loan.returnedQuantity;
      if (pending > 0) {
        loanPendingByGroup.set(loan.groupId, (loanPendingByGroup.get(loan.groupId) ?? 0) + pending);
      }
    }

    const groupsWithNotes = new Set<string>();
    for (const ev of notedReturns) {
      const groupId = ev.kitItem?.kit.groupId ?? ev.loan?.groupId;
      if (groupId) groupsWithNotes.add(groupId);
    }

    // --- Fila por grupo ---------------------------------------------------
    const rows = groups.map((group) => {
      const members = group.members.map((m) => m.student);
      const kit = kitByGroup.get(group.id) ?? null;

      const signedIds = new Set(kit?.acceptances.map((a) => a.studentId) ?? []);
      const pendingMembers: PendingMember[] = kit
        ? members.filter((m) => !signedIds.has(m.id))
        : members;

      // Sin kit no hay nada que firmar todavía: 0 de 0.
      const acceptance = {
        signed: kit ? members.length - pendingMembers.length : 0,
        total: kit ? members.length : 0,
        pendingMembers: kit ? pendingMembers : [],
      };

      const pendingKitUnits =
        kit?.items.reduce((sum, it) => sum + Math.max(0, it.quantity - it.returnedQuantity), 0) ??
        0;
      const pendingLoanUnits = loanPendingByGroup.get(group.id) ?? 0;

      const isVerified = kit?.verifiedAt != null;
      // Antes de verificar, todos los ítems están en `verified=false` por defecto:
      // eso no es una discrepancia, solo que aún no se ha revisado.
      // Refleja solo las PENDIENTES: una resuelta ya no pide acción del profesor.
      const hasDiscrepancies =
        isVerified && (kit?.items.some((it) => isPendingDiscrepancy(it)) ?? false);

      const returns = {
        allReturned: pendingKitUnits === 0 && pendingLoanUnits === 0,
        pendingKitUnits,
        pendingLoanUnits,
        hasReturnNotes: groupsWithNotes.has(group.id),
      };

      const needsAttention =
        (kit !== null && !isVerified) ||
        acceptance.pendingMembers.length > 0 ||
        hasDiscrepancies ||
        !returns.allReturned;

      return {
        groupId: group.id,
        groupName: group.name,
        memberCount: members.length,
        kit: kit
          ? {
              id: kit.id,
              code: kit.code,
              status: kit.status,
              isVerified,
              verifiedAt: kit.verifiedAt,
              hasDiscrepancies,
            }
          : null,
        acceptance,
        returns,
        needsAttention,
      };
    });

    // Primero lo que requiere atención; dentro de cada bloque, por nombre.
    rows.sort(
      (a, b) =>
        Number(b.needsAttention) - Number(a.needsAttention) ||
        a.groupName.localeCompare(b.groupName),
    );

    // --- Totales ----------------------------------------------------------
    const studentIds = new Set(groups.flatMap((g) => g.members.map((m) => m.student.id)));
    const assignedKits = kits.filter((k) => k.status === KitStatus.ASSIGNED);
    const verifiedKits = assignedKits.filter((k) => k.verifiedAt !== null);

    const totals = {
      groups: groups.length,
      students: studentIds.size,
      kitsAssigned: assignedKits.length,
      kitsVerified: verifiedKits.length,
      kitsPendingVerification: assignedKits.length - verifiedKits.length,
      acceptancesSigned: rows.reduce((s, r) => s + r.acceptance.signed, 0),
      acceptancesTotal: rows.reduce((s, r) => s + r.acceptance.total, 0),
      acceptancesPending: rows.reduce((s, r) => s + r.acceptance.pendingMembers.length, 0),
      groupsAllReturned: rows.filter((r) => r.returns.allReturned).length,
      groupsWithPending: rows.filter((r) => !r.returns.allReturned).length,
      itemsPendingReturn: rows.reduce((s, r) => s + r.returns.pendingKitUnits, 0),
      loansPendingReturn: rows.reduce((s, r) => s + r.returns.pendingLoanUnits, 0),
      // Ítems de kit no verificados o con nota, sobre kits YA verificados,
      // que todavía nadie ha resuelto.
      discrepancies: countDiscrepancies(kits, isPendingDiscrepancy),
      // Los ya atendidos, para que el resumen refleje el trabajo hecho.
      discrepanciesResolved: countDiscrepancies(
        kits,
        (it) => isDiscrepancy(it) && it._count.resolutions > 0,
      ),
    };

    return { course, totals, groups: rows };
  }
}
