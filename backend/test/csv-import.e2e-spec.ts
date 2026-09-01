import { INestApplication } from '@nestjs/common';
import { Course, Role, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './support/app';
import { as } from './support/auth';
import {
  createAdmin,
  createCourse,
  createGroup,
  createStudent,
  createUser,
  csvBuffer,
} from './support/fixtures';

/**
 * La importación NO es todo-o-nada: procesa fila por fila y devuelve un reporte con
 * lo importado, lo omitido y el motivo de cada error. Y es idempotente: volver a
 * subir el mismo archivo no duplica nada.
 */
describe('Importación de grupos por CSV', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: User;
  let curso: Course;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    admin = await createAdmin(prisma);
    curso = await createCourse(prisma, { name: 'Electrónica', year: 2026, semester: 1 });
  });

  const importar = (filas: [string, string, string, string][], cursoId = curso.id) =>
    as(app, admin)
      .post(`/api/courses/${cursoId}/groups/import`)
      .attach('file', csvBuffer(filas), 'alumnos.csv');

  describe('reporte de la importación', () => {
    it('crea alumnos y grupos que no existían y los cuenta en el resumen', async () => {
      const res = await importar([
        ['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1'],
        ['Alan', 'Turing', 'alan.turing@alumnos.ucn.cl', 'G1'],
        ['Grace', 'Hopper', 'grace.hopper@alumnos.ucn.cl', 'G2'],
      ]).expect(201);

      expect(res.body.summary).toMatchObject({
        totalRows: 3,
        imported: 3,
        skipped: 0,
        groupsCreated: 2,
      });
      expect(res.body.createdGroups.sort()).toEqual(['G1', 'G2']);
      expect(res.body.errors).toEqual([]);

      const grupos = await prisma.group.findMany({
        where: { courseId: curso.id },
        include: { members: { include: { student: true } } },
        orderBy: { name: 'asc' },
      });
      expect(grupos.map((g) => g.name)).toEqual(['G1', 'G2']);
      expect(grupos[0].members).toHaveLength(2);
      // Los usuarios se crean como alumnos, listos para enlazarse con Google.
      const ada = await prisma.user.findUniqueOrThrow({
        where: { email: 'ada.lovelace@alumnos.ucn.cl' },
      });
      expect(ada).toMatchObject({ name: 'Ada Lovelace', role: Role.STUDENT, googleId: null });
      expect(ada.roles).toEqual([Role.STUDENT]);
    });

    it('reutiliza el grupo si ya existe en vez de duplicarlo', async () => {
      await createGroup(prisma, curso, { name: 'G1' });

      const res = await importar([['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1']]).expect(
        201,
      );

      expect(res.body.summary).toMatchObject({ imported: 1, groupsCreated: 0 });
      expect(await prisma.group.count({ where: { courseId: curso.id } })).toBe(1);
    });

    it('reutiliza al alumno que ya estaba registrado', async () => {
      const existente = await createStudent(prisma, { email: 'ya.existe@alumnos.ucn.cl' });

      await importar([['Ya', 'Existe', 'ya.existe@alumnos.ucn.cl', 'G1']]).expect(201);

      expect(await prisma.user.count({ where: { email: 'ya.existe@alumnos.ucn.cl' } })).toBe(1);
      const miembro = await prisma.groupMember.findFirstOrThrow({
        where: { studentId: existente.id },
      });
      expect(miembro).toBeDefined();
    });
  });

  describe('idempotencia', () => {
    it('reimportar el mismo archivo no vuelve a importar a nadie', async () => {
      const filas: [string, string, string, string][] = [
        ['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1'],
        ['Alan', 'Turing', 'alan.turing@alumnos.ucn.cl', 'G1'],
      ];
      await importar(filas).expect(201);

      const res = await importar(filas).expect(201);

      expect(res.body.summary).toMatchObject({
        totalRows: 2,
        imported: 0,
        skipped: 2,
        groupsCreated: 0,
      });
      expect(res.body.errors).toEqual([]);
      expect(await prisma.groupMember.count()).toBe(2);
      expect(await prisma.user.count({ where: { role: Role.STUDENT } })).toBe(2);
    });
  });

  describe('errores por fila', () => {
    it('las filas válidas se importan aunque otras fallen', async () => {
      const res = await importar([
        ['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1'],
        ['Juan', 'Perez', 'juan.perez@gmail.com', 'G1'],
        ['Grace', 'Hopper', 'grace.hopper@alumnos.ucn.cl', 'G1'],
      ]).expect(201);

      expect(res.body.summary).toMatchObject({ totalRows: 3, imported: 2, skipped: 1 });
      expect(res.body.errors).toHaveLength(1);
      // La fila se reporta con su número real en el archivo (1 = encabezado).
      expect(res.body.errors[0]).toMatchObject({ row: 3, email: 'juan.perez@gmail.com' });
      expect(await prisma.user.findUnique({ where: { email: 'juan.perez@gmail.com' } })).toBeNull();
      expect(await prisma.groupMember.count()).toBe(2);
    });

    it('un correo que no es de alumno se reporta como error', async () => {
      const res = await importar([['Pedro', 'Profe', 'pedro.profe@ucn.cl', 'G1']]).expect(201);

      expect(res.body.errors[0].reason).toContain('no es de un alumno');
      expect(res.body.summary).toMatchObject({ imported: 0, skipped: 1 });
    });

    it('una fila sin nombre de grupo se reporta como error', async () => {
      const res = await importar([['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', '']]).expect(
        201,
      );

      expect(res.body.errors[0].reason).toContain('nombreGrupo');
      expect(await prisma.group.count()).toBe(0);
    });

    it('un alumno no puede quedar en dos grupos del mismo curso', async () => {
      await importar([['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1']]).expect(201);

      const res = await importar([['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G2']]).expect(
        201,
      );

      expect(res.body.errors[0].reason).toContain('ya pertenece al grupo "G1"');
      const membresías = await prisma.groupMember.findMany({
        include: { group: true },
      });
      expect(membresías).toHaveLength(1);
      expect(membresías[0].group.name).toBe('G1');
    });

    it('el mismo alumno SÍ puede estar en un grupo de otro curso', async () => {
      await importar([['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1']]).expect(201);
      const otroCurso = await createCourse(prisma, { name: 'Robótica' });

      const res = await importar(
        [['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1']],
        otroCurso.id,
      ).expect(201);

      expect(res.body.summary).toMatchObject({ imported: 1 });
      expect(await prisma.groupMember.count()).toBe(2);
    });
  });

  describe('aislamiento entre cursos', () => {
    it('dos cursos pueden tener un grupo con el mismo nombre sin chocar', async () => {
      const otroCurso = await createCourse(prisma, { name: 'Robótica' });

      await importar([['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1']]).expect(201);
      const res = await importar(
        [['Alan', 'Turing', 'alan.turing@alumnos.ucn.cl', 'G1']],
        otroCurso.id,
      ).expect(201);

      expect(res.body.summary).toMatchObject({ imported: 1, groupsCreated: 1 });
      const grupos = await prisma.group.findMany({ where: { name: 'G1' } });
      expect(grupos).toHaveLength(2);
      expect(new Set(grupos.map((g) => g.courseId)).size).toBe(2);
    });

    it('no se puede importar a un curso inexistente', async () => {
      await importar([['Ada', 'Lovelace', 'ada.lovelace@alumnos.ucn.cl', 'G1']], 'no-existe')
        // El guard de admin pasa; el 404 lo da la validación del curso.
        .expect(404);
    });
  });

  describe('validación del archivo', () => {
    it('el encabezado debe ser exactamente el esperado y en orden', async () => {
      const contenido = Buffer.from(
        'correo,nombre,apellido,nombreGrupo\na@alumnos.ucn.cl,Ada,Lovelace,G1',
        'utf8',
      );

      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/import`)
        .attach('file', contenido, 'alumnos.csv')
        .expect(400);

      expect(res.body.message).toContain('Encabezado inválido');
      expect(await prisma.group.count()).toBe(0);
    });

    it('solo se aceptan archivos .csv', async () => {
      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/import`)
        .attach('file', csvBuffer([['Ada', 'L', 'ada@alumnos.ucn.cl', 'G1']]), 'alumnos.xlsx')
        .expect(400);
    });

    it('falta el archivo → 400', async () => {
      await as(app, admin).post(`/api/courses/${curso.id}/groups/import`).expect(400);
    });
  });

  describe('alta manual de integrantes', () => {
    it('agrega un alumno nuevo y lo pre-registra', async () => {
      const grupo = await createGroup(prisma, curso, { name: 'G1' });

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/members`)
        .send({ email: 'Nueva.Alumna@Alumnos.UCN.cl' })
        .expect(201);

      // El correo se normaliza a minúsculas.
      const alumna = await prisma.user.findUniqueOrThrow({
        where: { email: 'nueva.alumna@alumnos.ucn.cl' },
      });
      expect(alumna.roles).toEqual([Role.STUDENT]);
    });

    it('no se puede agregar dos veces al mismo grupo', async () => {
      const alumno = await createStudent(prisma);
      const grupo = await createGroup(prisma, curso, { name: 'G1', members: [alumno] });

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/members`)
        .send({ email: alumno.email })
        .expect(409);
    });

    it('no se puede agregar a un alumno que ya está en otro grupo del curso', async () => {
      const alumno = await createStudent(prisma);
      await createGroup(prisma, curso, { name: 'G1', members: [alumno] });
      const g2 = await createGroup(prisma, curso, { name: 'G2' });

      const res = await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${g2.id}/members`)
        .send({ email: alumno.email })
        .expect(409);

      expect(res.body.message).toContain('"G1"');
      expect(await prisma.groupMember.count()).toBe(1);
    });

    it('un correo de profesor no puede ser integrante', async () => {
      const grupo = await createGroup(prisma, curso, { name: 'G1' });

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/members`)
        .send({ email: 'docente@ucn.cl' })
        .expect(400);
    });

    /*
     * BUG CONFIRMADO (reportado en la Fase 13, sin corregir).
     *
     * La regla documentada en `GroupsService.addMember` es explícita:
     *   "INCLUDES, no igualdad: un alumno que además esté en ADMIN_EMAILS sigue
     *    pudiendo ser miembro de un grupo".
     * El primer filtro la respeta (`resolveRoles(...).includes(STUDENT)`), pero el
     * siguiente compara el rol PRINCIPAL derivado (`existing.role !== Role.STUDENT`),
     * que para un alumno-admin es ADMIN, y lo rechaza. Debe evaluarse contra `roles`,
     * la fuente de verdad. Mismo patrón en `importRow` y en `resolveStudentUser`.
     * Cuando se corrija, cambia `it.failing` por `it`.
     */
    it.failing('un alumno que además es admin sigue pudiendo ser integrante', async () => {
      const alumnoAdmin = await createUser(prisma, {
        email: 'alumno.admin@alumnos.ucn.cl',
        roles: [Role.STUDENT, Role.ADMIN],
      });
      const grupo = await createGroup(prisma, curso, { name: 'G1' });

      await as(app, admin)
        .post(`/api/courses/${curso.id}/groups/${grupo.id}/members`)
        .send({ email: alumnoAdmin.email })
        .expect(201);
    });

    it.failing('el CSV también acepta a un alumno que además es admin', async () => {
      await createUser(prisma, {
        email: 'alumno.admin@alumnos.ucn.cl',
        roles: [Role.STUDENT, Role.ADMIN],
      });

      const res = await importar([['Alumno', 'Admin', 'alumno.admin@alumnos.ucn.cl', 'G1']]).expect(
        201,
      );

      expect(res.body.summary).toMatchObject({ imported: 1 });
    });

    it('quitar un integrante lo saca del grupo sin borrar su usuario', async () => {
      const alumno = await createStudent(prisma);
      const grupo = await createGroup(prisma, curso, { name: 'G1', members: [alumno] });

      await as(app, admin)
        .delete(`/api/courses/${curso.id}/groups/${grupo.id}/members/${alumno.id}`)
        .expect(200);

      expect(await prisma.groupMember.count()).toBe(0);
      expect(await prisma.user.count({ where: { id: alumno.id } })).toBe(1);
    });
  });
});
