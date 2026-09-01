import { KitStatus, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { primaryRole, sortByPrivilege } from '../../src/auth/role.util';

/**
 * Fixtures componibles. Todas reciben el `prisma` del test y devuelven la fila creada,
 * para poder encadenarlas:
 *
 *   const curso = await createCourse(prisma);
 *   const profe = await createProfessor(prisma, { authorizedIn: curso });
 *   const grupo = await createGroup(prisma, curso, { members: [alumno] });
 */

/** Contador por proceso: mantiene únicos los nombres/correos sin coordinar entre tests. */
let seq = 0;
export const uniqueSuffix = (): string => `${++seq}-${process.pid}`;

// --- Usuarios -----------------------------------------------------------

export interface CreateUserOptions {
  email?: string;
  name?: string;
  roles?: Role[];
  isActive?: boolean;
  googleId?: string | null;
}

export async function createUser(
  prisma: PrismaService,
  options: CreateUserOptions = {},
): Promise<User> {
  const roles = sortByPrivilege(options.roles ?? [Role.STUDENT]);
  const email = (options.email ?? `user-${uniqueSuffix()}@alumnos.ucn.cl`).toLowerCase();
  return prisma.user.create({
    data: {
      email,
      name: options.name ?? email.split('@')[0],
      roles,
      role: primaryRole(roles)!,
      isActive: options.isActive ?? true,
      googleId: options.googleId ?? null,
    },
  });
}

export const createStudent = (prisma: PrismaService, options: CreateUserOptions = {}) =>
  createUser(prisma, {
    email: `alumno-${uniqueSuffix()}@alumnos.ucn.cl`,
    roles: [Role.STUDENT],
    ...options,
  });

export const createAdmin = (prisma: PrismaService, options: CreateUserOptions = {}) =>
  createUser(prisma, {
    email: `admin-${uniqueSuffix()}@ucn.cl`,
    roles: [Role.ADMIN],
    ...options,
  });

/**
 * Profesor. `authorizedIn` crea de paso el `CourseProfessor` autorizado, que es lo que
 * mira `CourseAccessGuard`; sin él, tener el rol PROFESSOR no da acceso a ningún curso.
 */
export async function createProfessor(
  prisma: PrismaService,
  options: CreateUserOptions & {
    authorizedIn?: { id: string };
    unauthorizedIn?: { id: string };
  } = {},
): Promise<User> {
  const { authorizedIn, unauthorizedIn, ...userOptions } = options;
  const professor = await createUser(prisma, {
    email: `profe-${uniqueSuffix()}@ucn.cl`,
    roles: [Role.PROFESSOR],
    ...userOptions,
  });
  if (authorizedIn) await linkProfessor(prisma, authorizedIn.id, professor.id, true);
  if (unauthorizedIn) await linkProfessor(prisma, unauthorizedIn.id, professor.id, false);
  return professor;
}

export function linkProfessor(
  prisma: PrismaService,
  courseId: string,
  professorId: string,
  authorized = true,
) {
  return prisma.courseProfessor.create({ data: { courseId, professorId, authorized } });
}

/** Ayudante del curso (`CourseAssistant`), la tercera vía de `CourseOperateGuard`. */
export function linkAssistant(
  prisma: PrismaService,
  courseId: string,
  assistantId: string,
  active = true,
) {
  return prisma.courseAssistant.create({ data: { courseId, assistantId, active } });
}

/** Alumno que además es ayudante activo del curso indicado. */
export async function createAssistant(
  prisma: PrismaService,
  course: { id: string },
  options: CreateUserOptions & { active?: boolean } = {},
): Promise<User> {
  const { active = true, ...userOptions } = options;
  const student = await createStudent(prisma, userOptions);
  await linkAssistant(prisma, course.id, student.id, active);
  return student;
}

// --- Cursos y grupos ----------------------------------------------------

export interface CreateCourseOptions {
  name?: string;
  year?: number;
  semester?: number;
  termsDocumentId?: string | null;
}

export function createCourse(prisma: PrismaService, options: CreateCourseOptions = {}) {
  return prisma.course.create({
    data: {
      name: options.name ?? `Curso ${uniqueSuffix()}`,
      year: options.year ?? 2026,
      semester: options.semester ?? 1,
      termsDocumentId: options.termsDocumentId ?? null,
    },
  });
}

export async function createGroup(
  prisma: PrismaService,
  course: { id: string },
  options: { name?: string; members?: { id: string }[] } = {},
) {
  return prisma.group.create({
    data: {
      name: options.name ?? `Grupo ${uniqueSuffix()}`,
      courseId: course.id,
      members: options.members?.length
        ? { create: options.members.map((m) => ({ studentId: m.id })) }
        : undefined,
    },
  });
}

// --- Catálogo -----------------------------------------------------------

export function createComponent(
  prisma: PrismaService,
  options: { name?: string; code?: string | null; totalStock?: number } = {},
) {
  return prisma.component.create({
    data: {
      name: options.name ?? `Componente ${uniqueSuffix()}`,
      code: options.code ?? null,
      totalStock: options.totalStock ?? 10,
    },
  });
}

export function createTemplate(
  prisma: PrismaService,
  items: { component: { id: string }; quantity: number }[],
  options: { name?: string } = {},
) {
  return prisma.kitTemplate.create({
    data: {
      name: options.name ?? `Plantilla ${uniqueSuffix()}`,
      items: {
        create: items.map((i) => ({ componentId: i.component.id, quantity: i.quantity })),
      },
    },
    include: { items: true },
  });
}

// --- Kits ---------------------------------------------------------------

/** Un ítem del snapshot. `component: null` = ítem suelto, sin enlace al catálogo. */
export interface KitItemSeed {
  component?: { id: string; name: string } | null;
  /** Obligatorio cuando no hay componente del catálogo. */
  componentName?: string;
  quantity: number;
  returned?: number;
  verified?: boolean;
  verificationNote?: string | null;
}

export interface AssignKitOptions {
  code?: string;
  items: KitItemSeed[];
  templateId?: string;
  status?: KitStatus;
  /** Marca el kit como ya verificado por este alumno (salta el flujo del alumno). */
  verifiedBy?: { id: string };
}

/**
 * Kit ASIGNADO directamente en la base. Útil cuando el test necesita PARTIR de un kit
 * existente; los tests del propio flujo de asignación usan el endpoint real.
 */
export function createKit(
  prisma: PrismaService,
  course: { id: string },
  group: { id: string },
  options: AssignKitOptions,
) {
  return prisma.kit.create({
    data: {
      code: options.code ?? `KIT-${uniqueSuffix()}`,
      courseId: course.id,
      groupId: group.id,
      templateId: options.templateId ?? null,
      status: options.status ?? KitStatus.ASSIGNED,
      verifiedAt: options.verifiedBy ? new Date() : null,
      verifiedById: options.verifiedBy?.id ?? null,
      items: {
        create: options.items.map((i) => ({
          componentId: i.component?.id ?? null,
          componentName: i.componentName ?? i.component?.name ?? 'Ítem sin catálogo',
          quantity: i.quantity,
          returnedQuantity: i.returned ?? 0,
          verified: i.verified ?? false,
          verificationNote: i.verificationNote ?? null,
        })),
      },
    },
    include: { items: { orderBy: { componentName: 'asc' } } },
  });
}

export function createLoan(
  prisma: PrismaService,
  group: { id: string },
  loanedBy: { id: string },
  options: {
    component?: { id: string; name: string };
    componentName?: string;
    quantity?: number;
    returned?: number;
  } = {},
) {
  return prisma.loan.create({
    data: {
      groupId: group.id,
      componentId: options.component?.id ?? null,
      componentName: options.componentName ?? options.component?.name ?? 'Cable suelto',
      quantity: options.quantity ?? 1,
      returnedQuantity: options.returned ?? 0,
      loanedById: loanedBy.id,
    },
  });
}

// --- Condiciones de préstamo --------------------------------------------

export interface TermsVersionSeed {
  version: string;
  title?: string;
  body?: string;
  /** false deja un borrador (no vigente). */
  published?: boolean;
}

/**
 * Documento de condiciones con sus versiones. `isDefault: true` lo convierte en el
 * global (el que rige cuando un curso no tiene documento propio).
 */
export async function createTermsDocument(
  prisma: PrismaService,
  createdBy: { id: string },
  options: { name?: string; isDefault?: boolean; versions?: TermsVersionSeed[] } = {},
) {
  const versions = options.versions ?? [{ version: '1.0', published: true }];
  return prisma.termsDocument.create({
    data: {
      name: options.name ?? `Condiciones ${uniqueSuffix()}`,
      isDefault: options.isDefault ?? false,
      versions: {
        create: versions.map((v) => ({
          version: v.version,
          title: v.title ?? `Condiciones ${v.version}`,
          body: v.body ?? `Texto de las condiciones ${v.version}.`,
          publishedAt: (v.published ?? true) ? new Date() : null,
          createdById: createdBy.id,
        })),
      },
    },
    include: { versions: true },
  });
}

/** Atajo: el documento por defecto con una versión publicada. */
export const createDefaultTerms = (
  prisma: PrismaService,
  createdBy: { id: string },
  versions?: TermsVersionSeed[],
) =>
  createTermsDocument(prisma, createdBy, {
    name: 'Condiciones generales',
    isDefault: true,
    versions,
  });

// --- Consultas de apoyo -------------------------------------------------

/** Disponibilidad recalculada leyendo la base (lo que el test debe verificar de verdad). */
export async function availableInDb(prisma: PrismaService, componentId: string): Promise<number> {
  const component = await prisma.component.findUniqueOrThrow({
    where: { id: componentId },
    select: { totalStock: true },
  });
  const [kits, loans] = await Promise.all([
    prisma.kitItem.aggregate({
      where: { componentId, kit: { status: KitStatus.ASSIGNED } },
      _sum: { quantity: true, returnedQuantity: true },
    }),
    prisma.loan.aggregate({
      where: { componentId },
      _sum: { quantity: true, returnedQuantity: true },
    }),
  ]);
  const committed =
    (kits._sum.quantity ?? 0) -
    (kits._sum.returnedQuantity ?? 0) +
    ((loans._sum.quantity ?? 0) - (loans._sum.returnedQuantity ?? 0));
  return component.totalStock - committed;
}

/** CSV con el encabezado exacto que exige el importador. */
export function csvBuffer(rows: [string, string, string, string][]): Buffer {
  const header = 'nombre,apellido,correo,nombreGrupo';
  return Buffer.from([header, ...rows.map((r) => r.join(','))].join('\n'), 'utf8');
}

export type PrismaJson = Prisma.JsonValue;
