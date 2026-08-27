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
import { resolveRoles } from '../auth/role.util';
import { hasRole, type AuthenticatedUser } from '../auth/interfaces/auth.types';
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
   * - roles incluye ADMIN     → siempre.
   * - roles incluye PROFESSOR → solo si tiene un CourseProfessor autorizado en el curso.
   * - resto                   → denegado.
   *
   * Se evalúa POR CURSO y por rol presente en el array: un usuario puede ser
   * PROFESSOR en un curso y solo ayudante en otro.
   */
  async assertCourseAccess(user: AuthenticatedUser, courseId: string): Promise<void> {
    if (hasRole(user, Role.ADMIN)) return;

    if (hasRole(user, Role.PROFESSOR)) {
      const link = await this.prisma.courseProfessor.findUnique({
        where: { courseId_professorId: { courseId, professorId: user.id } },
      });
      if (link?.authorized) return;
    }

    throw new ForbiddenException('No estás autorizado en este curso');
  }

  /**
   * Regla de OPERACIÓN por curso (más amplia que "manage"):
   * - roles incluye ADMIN     → siempre.
   * - roles incluye PROFESSOR → si tiene CourseProfessor.authorized=true en el curso.
   * - ayudante activo         → si tiene CourseAssistant.active=true en el curso.
   *
   * Las tres vías se prueban en cadena, no como ramas excluyentes: un profesor no
   * autorizado en ESTE curso todavía puede ser ayudante en él.
   */
  async assertCourseOperate(user: AuthenticatedUser, courseId: string): Promise<void> {
    if (hasRole(user, Role.ADMIN)) return;

    if (hasRole(user, Role.PROFESSOR)) {
      const link = await this.prisma.courseProfessor.findUnique({
        where: { courseId_professorId: { courseId, professorId: user.id } },
      });
      if (link?.authorized) return;
    }

    const assistant = await this.prisma.courseAssistant.findUnique({
      where: { courseId_assistantId: { courseId, assistantId: user.id } },
    });
    if (assistant?.active) return;

    throw new ForbiddenException('No tienes permisos de operación en este curso');
  }

  // --- Ayudantes del curso ----------------------------------------------

  async listAssistants(courseId: string) {
    await this.ensureCourseExists(courseId);
    const rows = await this.prisma.courseAssistant.findMany({
      where: { courseId },
      include: { assistant: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((a) => ({
      assistantId: a.assistantId,
      active: a.active,
      createdAt: a.createdAt,
      assistant: a.assistant,
    }));
  }

  async addAssistant(courseId: string, email: string) {
    await this.ensureCourseExists(courseId);

    const normalizedEmail = email.trim().toLowerCase();
    // INCLUDES, no igualdad: un alumno que además es admin sigue siendo alumno.
    const derivedRoles = resolveRoles(normalizedEmail, this.adminEmails, this.professorEmails);
    if (!derivedRoles.includes(Role.STUDENT)) {
      throw new BadRequestException('El correo debe ser de un alumno (@alumnos.ucn.cl)');
    }

    const student = await this.resolveStudentUser(normalizedEmail);

    try {
      const created = await this.prisma.courseAssistant.create({
        data: { courseId, assistantId: student.id, active: true },
        include: { assistant: { select: { id: true, email: true, name: true } } },
      });
      return {
        assistantId: created.assistantId,
        active: created.active,
        createdAt: created.createdAt,
        assistant: created.assistant,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('El alumno ya es ayudante de este curso');
      }
      throw error;
    }
  }

  async setAssistantActive(courseId: string, assistantId: string, active: boolean) {
    try {
      const updated = await this.prisma.courseAssistant.update({
        where: { courseId_assistantId: { courseId, assistantId } },
        data: { active },
        include: { assistant: { select: { id: true, email: true, name: true } } },
      });
      return {
        assistantId: updated.assistantId,
        active: updated.active,
        assistant: updated.assistant,
      };
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('El alumno no es ayudante de este curso');
      }
      throw error;
    }
  }

  async removeAssistant(courseId: string, assistantId: string) {
    try {
      await this.prisma.courseAssistant.delete({
        where: { courseId_assistantId: { courseId, assistantId } },
      });
      return { deleted: true };
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new NotFoundException('El alumno no es ayudante de este curso');
      }
      throw error;
    }
  }

  /** Busca el User alumno por email; si no existe lo pre-crea como STUDENT. */
  private async resolveStudentUser(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== Role.STUDENT) {
        throw new BadRequestException('El usuario existe y no es un alumno');
      }
      return existing;
    }
    return this.prisma.user.create({
      data: {
        email,
        name: nameFromEmail(email),
        role: Role.STUDENT,
        roles: [Role.STUDENT],
        isActive: true,
      },
    });
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
    // El admin ve todos los cursos; el profesor (sin ser admin) solo los suyos.
    if (!hasRole(user, Role.ADMIN) && hasRole(user, Role.PROFESSOR)) {
      where.professors = { some: { professorId: user.id, authorized: true } };
    }

    const courses = await this.prisma.course.findMany({
      where,
      include: {
        _count: { select: { groups: true } },
        // Documento de condiciones asignado (null = usa el por defecto).
        termsDocument: { select: { id: true, name: true } },
      },
      orderBy: [{ year: 'desc' }, { semester: 'desc' }, { name: 'asc' }],
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      year: course.year,
      semester: course.semester,
      createdAt: course.createdAt,
      groupsCount: course._count.groups,
      termsDocumentId: course.termsDocumentId,
      termsDocumentName: course.termsDocument?.name ?? null,
    }));
  }

  async listTerms(user: AuthenticatedUser) {
    const where: Prisma.CourseWhereInput =
      !hasRole(user, Role.ADMIN) && hasRole(user, Role.PROFESSOR)
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
    const derivedRoles = resolveRoles(normalizedEmail, this.adminEmails, this.professorEmails);

    // Solo dominios de profesor (o un admin) pueden gestionar cursos.
    if (!derivedRoles.includes(Role.PROFESSOR) && !derivedRoles.includes(Role.ADMIN)) {
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
      // Con roles múltiples basta con que TENGA PROFESSOR o ADMIN; ser además
      // estudiante ya no lo descalifica.
      const roles = existing.roles.length > 0 ? existing.roles : [existing.role];
      if (!roles.includes(Role.PROFESSOR) && !roles.includes(Role.ADMIN)) {
        throw new BadRequestException('El usuario existe y es un estudiante, no un profesor');
      }
      return existing;
    }

    // Pre-registro: se enlazará con Google en el primer login (googleId null).
    return this.prisma.user.create({
      data: {
        email,
        name: nameFromEmail(email),
        role: Role.PROFESSOR,
        roles: [Role.PROFESSOR],
        isActive: true,
      },
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
