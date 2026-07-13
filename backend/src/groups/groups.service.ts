import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import Papa from 'papaparse';
import { PrismaService } from '../prisma/prisma.service';
import { resolveRole } from '../auth/role.util';

/** Deriva un nombre legible desde la parte local del correo. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ') || email
  );
}

const CSV_HEADERS = ['nombre', 'apellido', 'correo', 'nombreGrupo'] as const;

interface CsvRow {
  nombre?: string;
  apellido?: string;
  correo?: string;
  nombreGrupo?: string;
}

type RowOutcome =
  | { ok: false; email: string; reason: string }
  | { ok: true; imported: boolean; groupCreated?: string };

export interface ImportReport {
  summary: { totalRows: number; imported: number; skipped: number; groupsCreated: number };
  createdGroups: string[];
  errors: { row: number; email: string; reason: string }[];
}

@Injectable()
export class GroupsService {
  private readonly adminEmails: string[];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.adminEmails = (config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  // --- Grupos ------------------------------------------------------------

  async create(courseId: string, name: string) {
    await this.ensureCourseExists(courseId);
    try {
      return await this.prisma.group.create({ data: { name, courseId } });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un grupo con ese nombre en el curso');
      }
      throw error;
    }
  }

  async list(courseId: string) {
    await this.ensureCourseExists(courseId);
    const groups = await this.prisma.group.findMany({
      where: { courseId },
      include: {
        _count: { select: { members: true } },
        members: {
          include: { student: { select: { id: true, name: true, email: true } } },
          orderBy: { student: { name: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      membersCount: group._count.members,
      members: group.members.map((m) => m.student),
    }));
  }

  async getById(courseId: string, groupId: string) {
    await this.ensureGroupInCourse(courseId, groupId);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: { select: { members: true } },
        members: {
          include: { student: { select: { id: true, name: true, email: true } } },
          orderBy: { student: { name: 'asc' } },
        },
      },
    });

    // ensureGroupInCourse ya garantizó que existe.
    return {
      id: group!.id,
      name: group!.name,
      courseId: group!.courseId,
      createdAt: group!.createdAt,
      membersCount: group!._count.members,
      members: group!.members.map((m) => m.student),
    };
  }

  async rename(courseId: string, groupId: string, name: string) {
    await this.ensureGroupInCourse(courseId, groupId);
    try {
      return await this.prisma.group.update({ where: { id: groupId }, data: { name } });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un grupo con ese nombre en el curso');
      }
      throw error;
    }
  }

  async remove(courseId: string, groupId: string) {
    await this.ensureGroupInCourse(courseId, groupId);
    await this.prisma.group.delete({ where: { id: groupId } });
    return { deleted: true };
  }

  // --- Integrantes -------------------------------------------------------

  async addMember(courseId: string, groupId: string, rawEmail: string) {
    await this.ensureGroupInCourse(courseId, groupId);

    const email = rawEmail.trim().toLowerCase();
    if (resolveRole(email, this.adminEmails) !== Role.STUDENT) {
      throw new BadRequestException('El correo no es de un alumno (@alumnos.ucn.cl)');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== Role.STUDENT) {
      throw new BadRequestException('El correo pertenece a un usuario que no es alumno');
    }

    if (existing) {
      const inThisGroup = await this.prisma.groupMember.findUnique({
        where: { groupId_studentId: { groupId, studentId: existing.id } },
      });
      if (inThisGroup) {
        throw new ConflictException('El alumno ya es miembro de este grupo');
      }

      const inOtherGroup = await this.prisma.groupMember.findFirst({
        where: { studentId: existing.id, group: { courseId }, NOT: { groupId } },
        include: { group: { select: { name: true } } },
      });
      if (inOtherGroup) {
        throw new ConflictException(
          `El alumno ya pertenece al grupo "${inOtherGroup.group.name}" de este curso`,
        );
      }
    }

    const student = await this.prisma.$transaction(async (tx) => {
      const user =
        existing ??
        (await tx.user.create({
          data: { email, name: nameFromEmail(email), role: Role.STUDENT, isActive: true },
        }));
      await tx.groupMember.create({ data: { groupId, studentId: user.id } });
      return user;
    });

    return {
      groupId,
      studentId: student.id,
      student: { id: student.id, name: student.name, email: student.email },
    };
  }

  async removeMember(courseId: string, groupId: string, studentId: string) {
    await this.ensureGroupInCourse(courseId, groupId);
    try {
      await this.prisma.groupMember.delete({
        where: { groupId_studentId: { groupId, studentId } },
      });
      return { deleted: true };
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('El alumno no es miembro de este grupo');
      }
      throw error;
    }
  }

  // --- Importación CSV ---------------------------------------------------

  async importCsv(courseId: string, file: Express.Multer.File): Promise<ImportReport> {
    await this.ensureCourseExists(courseId);

    const content = file.buffer.toString('utf8');
    const parsed = Papa.parse<CsvRow>(content, { header: true, skipEmptyLines: true });

    const fields = parsed.meta.fields ?? [];
    const headerOk =
      fields.length === CSV_HEADERS.length && CSV_HEADERS.every((h, i) => fields[i] === h);
    if (!headerOk) {
      throw new BadRequestException(
        `Encabezado inválido. Se esperaba exactamente y en orden: ${CSV_HEADERS.join(
          ',',
        )}. Recibido: ${fields.join(',') || '(vacío)'}`,
      );
    }

    const rows = parsed.data;
    const createdGroups = new Set<string>();
    const errors: ImportReport['errors'] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const lineNumber = i + 2; // +1 por el encabezado, +1 para 1-index.
      const outcome = await this.importRow(courseId, rows[i]);
      if (!outcome.ok) {
        errors.push({ row: lineNumber, email: outcome.email, reason: outcome.reason });
        continue;
      }
      if (outcome.imported) imported++;
      if (outcome.groupCreated) createdGroups.add(outcome.groupCreated);
    }

    const totalRows = rows.length;
    return {
      summary: {
        totalRows,
        imported,
        skipped: totalRows - imported,
        groupsCreated: createdGroups.size,
      },
      createdGroups: [...createdGroups],
      errors,
    };
  }

  /** Procesa una fila del CSV de forma idempotente y transaccional. */
  private async importRow(courseId: string, row: CsvRow): Promise<RowOutcome> {
    const nombre = (row.nombre ?? '').trim();
    const apellido = (row.apellido ?? '').trim();
    const email = (row.correo ?? '').trim().toLowerCase();
    const groupName = (row.nombreGrupo ?? '').trim();
    const name = `${nombre} ${apellido}`.trim() || email;

    if (!email || resolveRole(email, this.adminEmails) !== Role.STUDENT) {
      return { ok: false, email, reason: 'El correo no es de un alumno (@alumnos.ucn.cl)' };
    }
    if (!groupName) {
      return { ok: false, email, reason: 'nombreGrupo vacío' };
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.role !== Role.STUDENT) {
      return { ok: false, email, reason: 'El correo pertenece a un usuario que no es alumno' };
    }

    // Regla "un alumno, un grupo por curso" + idempotencia.
    if (existingUser) {
      const membershipInCourse = await this.prisma.groupMember.findFirst({
        where: { studentId: existingUser.id, group: { courseId } },
        include: { group: { select: { name: true } } },
      });
      if (membershipInCourse) {
        if (membershipInCourse.group.name === groupName) {
          return { ok: true, imported: false }; // ya estaba en el grupo destino.
        }
        return {
          ok: false,
          email,
          reason: `El alumno ya pertenece al grupo "${membershipInCourse.group.name}" de este curso`,
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let group = await tx.group.findUnique({
        where: { name_courseId: { name: groupName, courseId } },
      });
      let groupCreated: string | undefined;
      if (!group) {
        group = await tx.group.create({ data: { name: groupName, courseId } });
        groupCreated = groupName;
      }

      const user =
        existingUser ??
        (await tx.user.create({
          data: { email, name, role: Role.STUDENT, isActive: true },
        }));

      const existingMembership = await tx.groupMember.findUnique({
        where: { groupId_studentId: { groupId: group.id, studentId: user.id } },
      });
      let imported = false;
      if (!existingMembership) {
        await tx.groupMember.create({ data: { groupId: group.id, studentId: user.id } });
        imported = true;
      }

      return { imported, groupCreated };
    });

    return { ok: true, imported: result.imported, groupCreated: result.groupCreated };
  }

  // --- Helpers -----------------------------------------------------------

  private async ensureCourseExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }
  }

  /** Garantiza que el grupo exista y pertenezca al curso indicado. */
  async ensureGroupInCourse(courseId: string, groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { courseId: true },
    });
    if (!group || group.courseId !== courseId) {
      throw new NotFoundException('Grupo no encontrado en este curso');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isNotFound(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
  }
}
