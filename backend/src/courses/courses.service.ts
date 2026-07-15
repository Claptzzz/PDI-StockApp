import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveRole } from '../auth/role.util';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses.query.dto';

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

@Injectable()
export class CoursesService {
  private readonly adminEmails: string[];
  private readonly professorEmails: string[];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const parse = (raw: string | undefined) =>
      (raw ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    this.adminEmails = parse(config.get<string>('ADMIN_EMAILS'));
    this.professorEmails = parse(config.get<string>('PROFESSOR_EMAILS'));
  }

  // --- Acceso ------------------------------------------------------------

  /**
   * Regla de acceso por curso, reutilizable desde guards u otros services:
   * - ADMIN     → siempre.
   * - PROFESSOR → solo si tiene un CourseProfessor autorizado en el curso.
   * - STUDENT   → denegado (su acceso se define en fases siguientes).
   */
  async assertCourseAccess(user: AuthenticatedUser, courseId: string): Promise<void> {
    if (user.role === Role.ADMIN) return;

    if (user.role === Role.PROFESSOR) {
      const link = await this.prisma.courseProfessor.findUnique({
        where: { courseId_professorId: { courseId, professorId: user.id } },
      });
      if (link?.authorized) return;
      throw new ForbiddenException('No estás autorizado en este curso');
    }

    throw new ForbiddenException('Acceso restringido a la gestión del curso');
  }

  // --- Cursos ------------------------------------------------------------

  async create(dto: CreateCourseDto) {
    try {
      return await this.prisma.course.create({
        data: { name: dto.name, year: dto.year, semester: dto.semester },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un curso con ese nombre, año y semestre');
      }
      throw error;
    }
  }

  async list(user: AuthenticatedUser, query: ListCoursesQueryDto) {
    const where: Prisma.CourseWhereInput = {};
    if (query.year !== undefined) where.year = query.year;
    if (query.semester !== undefined) where.semester = query.semester;
    if (user.role === Role.PROFESSOR) {
      where.professors = { some: { professorId: user.id, authorized: true } };
    }

    const courses = await this.prisma.course.findMany({
      where,
      include: { _count: { select: { groups: true } } },
      orderBy: [{ year: 'desc' }, { semester: 'desc' }, { name: 'asc' }],
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      year: course.year,
      semester: course.semester,
      createdAt: course.createdAt,
      groupsCount: course._count.groups,
    }));
  }

  async listTerms(user: AuthenticatedUser) {
    const where: Prisma.CourseWhereInput =
      user.role === Role.PROFESSOR
        ? { professors: { some: { professorId: user.id, authorized: true } } }
        : {};

    return this.prisma.course.findMany({
      where,
      select: { year: true, semester: true },
      distinct: ['year', 'semester'],
      orderBy: [{ year: 'desc' }, { semester: 'desc' }],
    });
  }

  async getById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        _count: { select: { groups: true } },
        professors: {
          include: { professor: { select: { id: true, email: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    return {
      id: course.id,
      name: course.name,
      year: course.year,
      semester: course.semester,
      createdAt: course.createdAt,
      groupsCount: course._count.groups,
      professors: course.professors.map((cp) => ({
        professorId: cp.professorId,
        authorized: cp.authorized,
        professor: cp.professor,
      })),
    };
  }

  async update(id: string, dto: UpdateCourseDto) {
    try {
      return await this.prisma.course.update({
        where: { id },
        data: { name: dto.name, year: dto.year, semester: dto.semester },
      });
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('Curso no encontrado');
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un curso con ese nombre, año y semestre');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.course.delete({ where: { id } });
      return { deleted: true };
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('Curso no encontrado');
      }
      throw error;
    }
  }

  // --- Profesores del curso ---------------------------------------------

  async listProfessors(courseId: string) {
    await this.ensureCourseExists(courseId);

    const rows = await this.prisma.courseProfessor.findMany({
      where: { courseId },
      include: {
        professor: { select: { id: true, email: true, name: true, role: true, isActive: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((cp) => ({
      professorId: cp.professorId,
      authorized: cp.authorized,
      createdAt: cp.createdAt,
      professor: cp.professor,
    }));
  }

  async addProfessor(courseId: string, email: string) {
    await this.ensureCourseExists(courseId);

    const normalizedEmail = email.trim().toLowerCase();
    const derivedRole = resolveRole(normalizedEmail, this.adminEmails, this.professorEmails);

    // Solo dominios de profesor (o un admin) pueden gestionar cursos.
    if (derivedRole === Role.STUDENT || derivedRole === null) {
      throw new BadRequestException('El correo no es de un profesor');
    }

    const professor = await this.resolveProfessorUser(normalizedEmail);

    try {
      const created = await this.prisma.courseProfessor.create({
        data: { courseId, professorId: professor.id, authorized: false },
        include: {
          professor: { select: { id: true, email: true, name: true, role: true } },
        },
      });
      return {
        professorId: created.professorId,
        authorized: created.authorized,
        createdAt: created.createdAt,
        professor: created.professor,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('El profesor ya está asignado a este curso');
      }
      throw error;
    }
  }

  async setProfessorAuthorization(courseId: string, professorId: string, authorized: boolean) {
    try {
      const updated = await this.prisma.courseProfessor.update({
        where: { courseId_professorId: { courseId, professorId } },
        data: { authorized },
        include: {
          professor: { select: { id: true, email: true, name: true, role: true } },
        },
      });
      return {
        professorId: updated.professorId,
        authorized: updated.authorized,
        professor: updated.professor,
      };
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('El profesor no está asignado a este curso');
      }
      throw error;
    }
  }

  async removeProfessor(courseId: string, professorId: string) {
    try {
      await this.prisma.courseProfessor.delete({
        where: { courseId_professorId: { courseId, professorId } },
      });
      return { deleted: true };
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('El profesor no está asignado a este curso');
      }
      throw error;
    }
  }

  // --- Helpers -----------------------------------------------------------

  /** Busca el User por email; si no existe lo pre-crea como PROFESSOR. */
  private async resolveProfessorUser(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role === Role.STUDENT) {
        throw new BadRequestException('El usuario existe y es un estudiante, no un profesor');
      }
      return existing;
    }

    // Pre-registro: se enlazará con Google en el primer login (googleId null).
    return this.prisma.user.create({
      data: { email, name: nameFromEmail(email), role: Role.PROFESSOR, isActive: true },
    });
  }

  private async ensureCourseExists(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isNotFound(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
  }
}
