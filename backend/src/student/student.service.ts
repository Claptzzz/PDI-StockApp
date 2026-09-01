import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { deriveLoanStatus } from '../loans/loans.service';
import { ResolvedTerms, TermsService } from '../terms/terms.service';
import { RESOLUTION_SELECT } from '../kits/discrepancies.service';
import { VerifyKitDto } from './dto/verify-kit.dto';
import { AcceptTermsDto } from './dto/accept-terms.dto';

/**
 * Motivo que ve el ALUMNO cuando el curso todavía no tiene condiciones publicadas.
 * Deliberadamente distinto del mensaje de `TermsService`, que instruye al admin sobre
 * un panel al que el alumno no tiene acceso.
 */
const TERMS_NOT_AVAILABLE =
  'Las condiciones de préstamo de este curso todavía no están disponibles. ' +
  'Avisa a tu profesor o ayudante para poder firmarlas.';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly terms: TermsService,
  ) {}

  /** Grupos del alumno (vía GroupMember), con curso y conteo de miembros. */
  async listMyGroups(studentId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { studentId },
      include: {
        group: {
          include: {
            course: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    return memberships
      .map((m) => ({
        groupId: m.group.id,
        groupName: m.group.name,
        course: {
          id: m.group.course.id,
          name: m.group.course.name,
          year: m.group.course.year,
          semester: m.group.course.semester,
        },
        memberCount: m.group._count.members,
      }))
      .sort(
        (a, b) =>
          b.course.year - a.course.year ||
          b.course.semester - a.course.semester ||
          a.groupName.localeCompare(b.groupName),
      );
  }

  /** Cursos donde el usuario es ayudante ACTIVO. */
  async listAssistantCourses(userId: string) {
    const rows = await this.prisma.courseAssistant.findMany({
      where: { assistantId: userId, active: true },
      include: { course: true },
      orderBy: [{ course: { year: 'desc' } }, { course: { semester: 'desc' } }],
    });
    return rows.map((r) => ({
      course: {
        id: r.course.id,
        name: r.course.name,
        year: r.course.year,
        semester: r.course.semester,
      },
    }));
  }

  /**
   * Contextos del usuario: cursos donde es ayudante activo (hatType ASSISTANT) y
   * cursos donde es miembro de un grupo (hatType STUDENT). ASSISTANT tiene prioridad
   * si un curso apareciera en ambos. Ordena por año y semestre desc.
   */
  async getContexts(userId: string) {
    const [assistant, memberships] = await Promise.all([
      this.prisma.courseAssistant.findMany({
        where: { assistantId: userId, active: true },
        include: { course: true },
      }),
      this.prisma.groupMember.findMany({
        where: { studentId: userId },
        include: { group: { include: { course: true } } },
      }),
    ]);

    type Context = {
      courseId: string;
      courseName: string;
      year: number;
      semester: number;
      hatType: 'ASSISTANT' | 'STUDENT';
    };
    const map = new Map<string, Context>();

    for (const a of assistant) {
      map.set(a.course.id, {
        courseId: a.course.id,
        courseName: a.course.name,
        year: a.course.year,
        semester: a.course.semester,
        hatType: 'ASSISTANT',
      });
    }
    for (const m of memberships) {
      const c = m.group.course;
      if (!map.has(c.id)) {
        map.set(c.id, {
          courseId: c.id,
          courseName: c.name,
          year: c.year,
          semester: c.semester,
          hatType: 'STUDENT',
        });
      }
    }

    return [...map.values()].sort((a, b) => b.year - a.year || b.semester - a.semester);
  }

  /** Detalle de un grupo del alumno. Valida que sea miembro (si no, 403). */
  async getMyGroup(studentId: string, groupId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_studentId: { groupId, studentId } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('No perteneces a este grupo');
    }

    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      include: {
        course: true,
        members: {
          include: { student: { select: { id: true, name: true, email: true } } },
          orderBy: { student: { name: 'asc' } },
        },
        kits: {
          include: { items: { orderBy: { componentName: 'asc' } } },
          orderBy: { assignedAt: 'desc' },
        },
        loans: { orderBy: { loanedAt: 'desc' } },
      },
    });

    // Aceptaciones del propio alumno, para saber qué kits le faltan aceptar.
    const myAcceptances = await this.prisma.kitAcceptance.findMany({
      where: { studentId, kitId: { in: group.kits.map((k) => k.id) } },
      select: { kitId: true },
    });
    const acceptedKitIds = new Set(myAcceptances.map((a) => a.kitId));

    const kits = group.kits.map((kit) => ({
      id: kit.id,
      code: kit.code,
      status: kit.status,
      // Flags para el aviso "Debes verificar tu kit" sin pedir el detalle de cada kit.
      isVerified: kit.verifiedAt !== null,
      hasAccepted: acceptedKitIds.has(kit.id),
      items: kit.items.map((it) => ({
        componentName: it.componentName,
        quantity: it.quantity,
        returnedQuantity: it.returnedQuantity,
        pending: it.quantity - it.returnedQuantity,
      })),
    }));

    const loans = await Promise.all(
      group.loans.map(async (loan) => ({
        id: loan.id,
        componentName: loan.componentName,
        quantity: loan.quantity,
        returnedQuantity: loan.returnedQuantity,
        pending: loan.quantity - loan.returnedQuantity,
        status: deriveLoanStatus(loan.quantity, loan.returnedQuantity),
        note: loan.note,
        signedUrl: loan.photoUrl ? await this.storage.getSignedUrl(loan.photoUrl) : null,
      })),
    );

    const kitsPending = kits.some((k) => k.items.some((it) => it.pending > 0));
    const loansPending = loans.some((l) => l.pending > 0);

    return {
      groupId: group.id,
      groupName: group.name,
      course: {
        id: group.course.id,
        name: group.course.name,
        year: group.course.year,
        semester: group.course.semester,
      },
      members: group.members.map((m) => m.student),
      kits,
      loans,
      allReturned: !kitsPending && !loansPending,
    };
  }

  // --- Verificación de entrega y aceptación de condiciones -----------------

  /**
   * Carga el kit validando que el usuario sea miembro del grupo dueño (403 si no).
   * Devuelve el kit con ítems, verificador, integrantes del grupo y aceptaciones.
   */
  private async loadMyKit(studentId: string, kitId: string) {
    const kit = await this.prisma.kit.findUnique({
      where: { id: kitId },
      include: {
        items: {
          orderBy: { componentName: 'asc' },
          // El alumno ve qué se decidió sobre lo que él reportó (cierra el ciclo).
          include: { resolutions: { orderBy: { createdAt: 'asc' }, select: RESOLUTION_SELECT } },
        },
        verifiedBy: { select: { id: true, name: true } },
        acceptances: { select: { studentId: true, acceptedAt: true, termsVersion: true } },
        group: {
          select: {
            id: true,
            name: true,
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
    // La pertenencia se comprueba contra los miembros que ya trajimos (sin query extra).
    if (!kit.group.members.some((m) => m.student.id === studentId)) {
      throw new ForbiddenException('No perteneces al grupo de este kit');
    }
    return kit;
  }

  /** Serializa el kit al shape que consume la pantalla de verificación del alumno. */
  private serializeMyKit(kit: Awaited<ReturnType<StudentService['loadMyKit']>>, studentId: string) {
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
      assignedAt: kit.assignedAt,
      /// El modal de condiciones pide el texto vigente PARA ESTE CURSO.
      courseId: kit.courseId,
      groupId: kit.group.id,
      groupName: kit.group.name,
      items: kit.items.map((it) => ({
        id: it.id,
        componentName: it.componentName,
        quantity: it.quantity,
        verified: it.verified,
        verificationNote: it.verificationNote,
        resolutions: it.resolutions,
      })),
      verifiedAt: kit.verifiedAt,
      verifiedBy: kit.verifiedBy,
      members,
      isVerified: kit.verifiedAt !== null,
      hasAccepted: acceptanceByStudent.has(studentId),
      /** Fecha en que aceptó el usuario ACTUAL (null si aún no acepta). */
      myAcceptedAt: acceptanceByStudent.get(studentId)?.acceptedAt ?? null,
      allAccepted: members.length > 0 && members.every((m) => m.accepted),
    };
  }

  /**
   * Condiciones vigentes del curso, o `null` si todavía no hay ninguna publicada.
   *
   * `resolveForCourse` lanza 409 cuando no hay documento resoluble. Eso es correcto al
   * FIRMAR, pero no al LEER: dejaría al alumno sin pantalla de verificación por un
   * problema de configuración que él no puede arreglar. Aquí el 409 se traduce a
   * `null` y quien llama decide. El 404 (curso inexistente) sí es un error real y se
   * deja pasar.
   */
  private async currentTerms(courseId: string): Promise<ResolvedTerms | null> {
    try {
      return await this.terms.resolveForCourse(courseId);
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Detalle del kit para la pantalla de verificación del alumno.
   *
   * VER el kit no depende de que existan condiciones: si no las hay, el detalle llega
   * igual con `canAccept: false` y el motivo, y solo se bloquea la firma.
   */
  async getMyKit(studentId: string, kitId: string) {
    const kit = await this.loadMyKit(studentId, kitId);
    // La etiqueta vigente depende del documento asignado al curso del kit.
    const terms = await this.currentTerms(kit.courseId);
    return {
      ...this.serializeMyKit(kit, studentId),
      /** Versión vigente que se reenvía al firmar; null si aún no hay ninguna. */
      termsVersion: terms?.version ?? null,
      /** ¿Hay condiciones vigentes que firmar? (independiente de la verificación). */
      canAccept: terms !== null,
      acceptBlockedReason: terms === null ? TERMS_NOT_AVAILABLE : null,
    };
  }

  /**
   * Verificación GRUPAL de la entrega: la hace un integrante, UNA sola vez.
   * Exige el formulario completo (todos los ítems del kit) para que un ítem
   * ausente del body no se confunda con "no recibido".
   *
   * NO toca quantity ni el stock: las discrepancias solo quedan registradas.
   */
  async verifyKit(studentId: string, kitId: string, dto: VerifyKitDto) {
    const kit = await this.loadMyKit(studentId, kitId);

    if (kit.verifiedAt !== null) {
      const who = kit.verifiedBy?.name ?? 'otro integrante';
      throw new ConflictException(`El kit ya fue verificado por ${who}`);
    }

    const kitItemIds = new Set(kit.items.map((it) => it.id));
    const sentIds = dto.items.map((it) => it.kitItemId);

    const duplicated = sentIds.length !== new Set(sentIds).size;
    if (duplicated) {
      throw new BadRequestException('Hay kitItemId repetidos en la verificación');
    }

    const foreign = sentIds.filter((id) => !kitItemIds.has(id));
    if (foreign.length > 0) {
      throw new BadRequestException(`Estos ítems no pertenecen a este kit: ${foreign.join(', ')}`);
    }

    const sentSet = new Set(sentIds);
    const missing = kit.items.filter((it) => !sentSet.has(it.id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Falta verificar ${missing.length} ítem(s) del kit: ${missing
          .map((it) => it.componentName)
          .join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Cierre condicional: solo gana el primer envío si dos integrantes envían a la vez.
      const claimed = await tx.kit.updateMany({
        where: { id: kitId, verifiedAt: null },
        data: { verifiedAt: new Date(), verifiedById: studentId },
      });
      if (claimed.count === 0) {
        throw new ConflictException('El kit ya fue verificado por otro integrante');
      }

      for (const item of dto.items) {
        await tx.kitItem.update({
          where: { id: item.kitItemId },
          data: { verified: item.verified, verificationNote: item.note ?? null },
        });
      }
    });

    return this.getMyKit(studentId, kitId);
  }

  /**
   * Aceptación INDIVIDUAL de las condiciones. Requiere kit verificado y que la
   * versión enviada sea la vigente (si no, el alumno leyó un texto obsoleto).
   */
  async acceptTerms(studentId: string, kitId: string, dto: AcceptTermsDto) {
    const kit = await this.loadMyKit(studentId, kitId);

    if (kit.verifiedAt === null) {
      throw new ConflictException('Primero deben verificar el kit');
    }

    // Firmar SÍ exige condiciones vigentes; el mensaje va dirigido al alumno.
    const terms = await this.currentTerms(kit.courseId);
    if (!terms) {
      throw new ConflictException(TERMS_NOT_AVAILABLE);
    }
    if (dto.termsVersion !== terms.version) {
      throw new ConflictException('Las condiciones cambiaron, recarga la página');
    }

    try {
      await this.prisma.kitAcceptance.create({
        data: { kitId, studentId, termsVersion: terms.version },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya aceptaste las condiciones de este kit');
      }
      throw error;
    }

    return this.getMyKit(studentId, kitId);
  }
}
