import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { deriveLoanStatus } from '../loans/loans.service';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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

    const kits = group.kits.map((kit) => ({
      id: kit.id,
      code: kit.code,
      status: kit.status,
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
}
