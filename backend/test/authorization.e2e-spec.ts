import { INestApplication } from '@nestjs/common';
import { Course, Group, Role, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './support/app';
import { anonymous, as } from './support/auth';
import {
  createAdmin,
  createComponent,
  createCourse,
  createGroup,
  createKit,
  createProfessor,
  createStudent,
  createUser,
  csvBuffer,
  linkAssistant,
  uniqueSuffix,
} from './support/fixtures';

/**
 * Matriz de permisos. Cada endpoint se prueba con los seis actores posibles para que
 * un cambio de guard no pueda ampliar el acceso en silencio.
 */
describe('Autorización por curso', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let curso: Course;
  let otroCurso: Course;
  let grupo: Group;

  let admin: User;
  let profesorAutorizado: User;
  let profesorSinAutorizar: User;
  let ayudanteActivo: User;
  let ayudanteInactivo: User;
  let alumnoDelCurso: User;
  let ajeno: User;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);

    curso = await createCourse(prisma, { name: 'Electrónica' });
    otroCurso = await createCourse(prisma, { name: 'Robótica' });

    admin = await createAdmin(prisma);
    profesorAutorizado = await createProfessor(prisma, { authorizedIn: curso });
    // Asignado al curso pero SIN autorizar: es la diferencia que mira el guard.
    profesorSinAutorizar = await createProfessor(prisma, { unauthorizedIn: curso });
    ayudanteActivo = await createStudent(prisma);
    await linkAssistant(prisma, curso.id, ayudanteActivo.id, true);
    ayudanteInactivo = await createStudent(prisma);
    await linkAssistant(prisma, curso.id, ayudanteInactivo.id, false);
    alumnoDelCurso = await createStudent(prisma);
    // Profesor de OTRO curso: rol correcto, curso equivocado.
    ajeno = await createProfessor(prisma, { authorizedIn: otroCurso });

    grupo = await createGroup(prisma, curso, { members: [alumnoDelCurso] });
  });

  /** Los seis actores, en el mismo orden para todos los endpoints. */
  const actores = () => ({
    admin,
    'profesor autorizado': profesorAutorizado,
    'profesor no autorizado en el curso': profesorSinAutorizar,
    'ayudante activo': ayudanteActivo,
    'ayudante desactivado': ayudanteInactivo,
    'alumno del curso': alumnoDelCurso,
    'profesor de otro curso': ajeno,
  });

  type Caso = [actor: keyof ReturnType<typeof actores>, esperado: number];

  /** Permisos de GESTIÓN: solo ADMIN y PROFESSOR autorizado (CourseAccessGuard). */
  const GESTION: Caso[] = [
    ['admin', 201],
    ['profesor autorizado', 201],
    ['profesor no autorizado en el curso', 403],
    ['ayudante activo', 403],
    ['ayudante desactivado', 403],
    ['alumno del curso', 403],
    ['profesor de otro curso', 403],
  ];

  /** Permisos de OPERACIÓN: los anteriores + el ayudante activo (CourseOperateGuard). */
  const OPERACION: Caso[] = [
    ['admin', 201],
    ['profesor autorizado', 201],
    ['profesor no autorizado en el curso', 403],
    ['ayudante activo', 201],
    ['ayudante desactivado', 403],
    ['alumno del curso', 403],
    ['profesor de otro curso', 403],
  ];

  describe('gestión del curso: crear un grupo', () => {
    it.each(GESTION)('%s → %i', async (actor, esperado) => {
      const nombre = `Grupo ${uniqueSuffix()}`;
      await as(app, actores()[actor])
        .post(`/api/courses/${curso.id}/groups`)
        .send({ name: nombre })
        .expect(esperado);

      const creado = await prisma.group.findUnique({
        where: { name_courseId: { name: nombre, courseId: curso.id } },
      });
      // El efecto en la base debe coincidir con el veredicto del guard.
      expect(Boolean(creado)).toBe(esperado === 201);
    });

    it('sin token no se puede ni intentar', async () => {
      await anonymous(app)
        .post(`/api/courses/${curso.id}/groups`)
        .send({ name: 'Anónimo' })
        .expect(401);
    });
  });

  describe('gestión del curso: agregar un integrante al grupo', () => {
    it.each(GESTION)('%s → %i', async (actor, esperado) => {
      const email = `nuevo-${uniqueSuffix()}@alumnos.ucn.cl`;
      await as(app, actores()[actor])
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/members`)
        .send({ email })
        .expect(esperado);

      const usuario = await prisma.user.findUnique({ where: { email } });
      expect(Boolean(usuario)).toBe(esperado === 201);
    });
  });

  describe('gestión del curso: importar el CSV de grupos', () => {
    // La importación responde 201 (POST) tanto si importa como si reporta errores.
    it.each(GESTION)('%s → %i', async (actor, esperado) => {
      const email = `csv-${uniqueSuffix()}@alumnos.ucn.cl`;
      await as(app, actores()[actor])
        .post(`/api/courses/${curso.id}/groups/import`)
        .attach('file', csvBuffer([['Ada', 'Lovelace', email, 'G-CSV']]), 'alumnos.csv')
        .expect(esperado);

      const usuario = await prisma.user.findUnique({ where: { email } });
      expect(Boolean(usuario)).toBe(esperado === 201);
    });
  });

  describe('operación del curso: asignar un kit', () => {
    it.each(OPERACION)('%s → %i', async (actor, esperado) => {
      const componente = await createComponent(prisma, { totalStock: 50 });
      const code = `KIT-${uniqueSuffix()}`;

      await as(app, actores()[actor])
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/kits`)
        .send({ code, items: [{ componentId: componente.id, quantity: 1 }] })
        .expect(esperado);

      const kit = await prisma.kit.findUnique({
        where: { code_courseId: { code, courseId: curso.id } },
      });
      expect(Boolean(kit)).toBe(esperado === 201);
    });
  });

  describe('operación del curso: registrar un préstamo', () => {
    it.each(OPERACION)('%s → %i', async (actor, esperado) => {
      const componentName = `Cable ${uniqueSuffix()}`;

      await as(app, actores()[actor])
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/loans`)
        .send({ componentName, quantity: 1 })
        .expect(esperado);

      const prestamo = await prisma.loan.findFirst({ where: { componentName } });
      expect(Boolean(prestamo)).toBe(esperado === 201);
    });
  });

  describe('operación del curso: registrar una devolución', () => {
    // PATCH responde 200, no 201: se traduce el veredicto de la matriz.
    it.each(OPERACION)('%s → %i', async (actor, esperado) => {
      const componente = await createComponent(prisma, { totalStock: 20 });
      const kit = await createKit(prisma, curso, grupo, {
        items: [{ component: componente, quantity: 3 }],
      });
      const esperadoPatch = esperado === 201 ? 200 : esperado;

      await as(app, actores()[actor])
        .patch(
          `/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}/items/${kit.items[0].id}/return`,
        )
        .send({ quantity: 1 })
        .expect(esperadoPatch);

      const item = await prisma.kitItem.findUniqueOrThrow({ where: { id: kit.items[0].id } });
      expect(item.returnedQuantity).toBe(esperadoPatch === 200 ? 1 : 0);
    });
  });

  describe('usuarios con varios roles', () => {
    it('un profesor que además es ayudante en otro curso gestiona el suyo y solo opera en el ajeno', async () => {
      // Alumno listado en PROFESSOR_EMAILS: roles [PROFESSOR, STUDENT] de verdad.
      const mixto = await createUser(prisma, {
        email: 'ayudante.profe@alumnos.ucn.cl',
        roles: [Role.STUDENT, Role.PROFESSOR],
      });
      await prisma.courseProfessor.create({
        data: { courseId: curso.id, professorId: mixto.id, authorized: true },
      });
      await linkAssistant(prisma, otroCurso.id, mixto.id, true);
      const grupoAjeno = await createGroup(prisma, otroCurso);

      // En SU curso: gestiona.
      await as(app, mixto)
        .post(`/api/courses/${curso.id}/groups`)
        .send({ name: `Suyo ${uniqueSuffix()}` })
        .expect(201);

      // En el curso donde es ayudante: opera pero NO gestiona.
      await as(app, mixto).get(`/api/courses/${otroCurso.id}/groups/${grupoAjeno.id}`).expect(200);
      await as(app, mixto)
        .post(`/api/courses/${otroCurso.id}/groups`)
        .send({ name: `Ajeno ${uniqueSuffix()}` })
        .expect(403);
    });

    /*
     * BUG CONFIRMADO (reportado en la Fase 13, sin corregir). Tercera aparición del
     * mismo patrón que en `GroupsService`: `CoursesService.resolveStudentUser` decide
     * con el rol PRINCIPAL (`existing.role !== Role.STUDENT`) en vez de con `roles`,
     * así que un alumno-admin no puede ser nombrado ayudante aunque
     * `resolveRoles(...)` sí incluya STUDENT (comprobación que el propio método hace
     * dos líneas antes). Cuando se corrija, cambia `it.failing` por `it`.
     */
    it.failing('un alumno que además es admin puede ser nombrado ayudante', async () => {
      const alumnoAdmin = await createUser(prisma, {
        email: 'alumno.admin@alumnos.ucn.cl',
        roles: [Role.STUDENT, Role.ADMIN],
      });

      await as(app, admin)
        .post(`/api/courses/${curso.id}/assistants`)
        .send({ email: alumnoAdmin.email })
        .expect(201);
    });

    it('un alumno que además es admin conserva el acceso de alumno y gana el de admin', async () => {
      const alumnoAdmin = await createUser(prisma, {
        email: 'alumno.admin@alumnos.ucn.cl',
        roles: [Role.STUDENT, Role.ADMIN],
      });
      await prisma.groupMember.create({
        data: { groupId: grupo.id, studentId: alumnoAdmin.id },
      });

      // Ruta exclusiva de ADMIN.
      await as(app, alumnoAdmin).get('/api/users').expect(200);
      // Ruta exclusiva de STUDENT (@Roles(STUDENT) en StudentController).
      await as(app, alumnoAdmin).get('/api/me/groups').expect(200);
    });
  });

  describe('aislamiento entre cursos', () => {
    it('un grupo de otro curso no existe bajo el :courseId equivocado', async () => {
      const grupoDelOtroCurso = await createGroup(prisma, otroCurso);

      // El admin pasa el guard: el 404 viene de la validación grupo↔curso, no del permiso.
      await as(app, admin)
        .get(`/api/courses/${curso.id}/groups/${grupoDelOtroCurso.id}`)
        .expect(404);
    });

    it('no se puede asignar un kit a un grupo que pertenece a otro curso', async () => {
      const grupoDelOtroCurso = await createGroup(prisma, otroCurso);
      const componente = await createComponent(prisma, { totalStock: 10 });

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupoDelOtroCurso.id}/kits`)
        .send({ code: 'CRUZADO', items: [{ componentId: componente.id, quantity: 1 }] })
        .expect(404);

      expect(await prisma.kit.count()).toBe(0);
    });

    it('un kit de otro grupo no es accesible desde este grupo', async () => {
      const otroGrupo = await createGroup(prisma, curso);
      const componente = await createComponent(prisma, { totalStock: 10 });
      const kit = await createKit(prisma, curso, otroGrupo, {
        items: [{ component: componente, quantity: 1 }],
      });

      await as(app, admin)
        .get(`/api/courses/${curso.id}/groups/${grupo.id}/kits/${kit.id}`)
        .expect(404);
    });
  });

  describe('lectura del catálogo', () => {
    it('un alumno sin ayudantía no puede ver el catálogo de componentes', async () => {
      await as(app, alumnoDelCurso).get('/api/components').expect(403);
    });

    it('un ayudante activo sí puede verlo, porque lo necesita para operar', async () => {
      await as(app, ayudanteActivo).get('/api/components').expect(200);
    });

    it('un ayudante desactivado deja de verlo', async () => {
      await as(app, ayudanteInactivo).get('/api/components').expect(403);
    });

    it('profesores y administradores lo ven siempre', async () => {
      await as(app, profesorSinAutorizar).get('/api/components').expect(200);
      await as(app, admin).get('/api/components').expect(200);
    });

    it('solo el admin puede crear componentes', async () => {
      await as(app, profesorAutorizado)
        .post('/api/components')
        .send({ name: `X ${uniqueSuffix()}`, totalStock: 1 })
        .expect(403);
      await as(app, admin)
        .post('/api/components')
        .send({ name: `Y ${uniqueSuffix()}`, totalStock: 1 })
        .expect(201);
    });
  });
});
