import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { googleIdToken, invalidGoogleIdToken } from './mocks/google.mock';
import { createTestApp, resetDb } from './support/app';
import { anonymous, as, signTokenForMissingUser, withToken } from './support/auth';
import { createAdmin, createStudent, createUser } from './support/fixtures';

describe('Autenticación y resolución de roles', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  /** Login real contra `POST /api/auth/google` con el idToken de Google mockeado. */
  const login = (email: string, extra: { name?: string; emailVerified?: boolean } = {}) =>
    anonymous(app)
      .post('/api/auth/google')
      .send({
        idToken: googleIdToken({
          email,
          name: extra.name,
          email_verified: extra.emailVerified,
        }),
      });

  describe('roles derivados del correo', () => {
    it('un correo @alumnos.ucn.cl entra como alumno', async () => {
      const res = await login('nuevo.alumno@alumnos.ucn.cl').expect(200);

      expect(res.body.user.roles).toEqual([Role.STUDENT]);
      expect(res.body.user.role).toBe(Role.STUDENT);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'nuevo.alumno@alumnos.ucn.cl' },
      });
      expect(stored.roles).toEqual([Role.STUDENT]);
      expect(stored.googleId).not.toBeNull();
    });

    it('un correo @ucn.cl entra como profesor', async () => {
      const res = await login('docente@ucn.cl').expect(200);
      expect(res.body.user.roles).toEqual([Role.PROFESSOR]);
    });

    it('un correo @ce.ucn.cl también entra como profesor', async () => {
      const res = await login('funcionario@ce.ucn.cl').expect(200);
      expect(res.body.user.roles).toEqual([Role.PROFESSOR]);
    });

    it('los allowlists son ADITIVOS: un alumno listado en ADMIN_EMAILS conserva STUDENT y suma ADMIN', async () => {
      const res = await login('alumno.admin@alumnos.ucn.cl').expect(200);

      expect(res.body.user.roles.sort()).toEqual([Role.ADMIN, Role.STUDENT].sort());
      // El rol principal es el de mayor privilegio, pero NO reemplaza al array.
      expect(res.body.user.role).toBe(Role.ADMIN);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'alumno.admin@alumnos.ucn.cl' },
      });
      expect(stored.roles).toContain(Role.STUDENT);
      expect(stored.roles).toContain(Role.ADMIN);
    });

    it('un correo de PROFESSOR_EMAILS entra como profesor aunque su dominio no sea institucional', async () => {
      const res = await login('externo.test@gmail.com').expect(200);
      expect(res.body.user.roles).toEqual([Role.PROFESSOR]);
    });

    it('un alumno listado en PROFESSOR_EMAILS acumula ambos roles', async () => {
      const res = await login('ayudante.profe@alumnos.ucn.cl').expect(200);
      expect(res.body.user.roles.sort()).toEqual([Role.PROFESSOR, Role.STUDENT].sort());
    });

    it('un dominio no institucional que no está en ningún allowlist no puede entrar', async () => {
      await login('cualquiera@gmail.com').expect(403);

      const stored = await prisma.user.findUnique({ where: { email: 'cualquiera@gmail.com' } });
      expect(stored).toBeNull();
    });
  });

  describe('vínculo con la cuenta existente', () => {
    it('el login UNE roles y nunca resta los concedidos a mano', async () => {
      // Un admin le dio PROFESSOR a un alumno; su correo solo deriva STUDENT.
      const alumno = await createUser(prisma, {
        email: 'con.extra@alumnos.ucn.cl',
        roles: [Role.STUDENT, Role.PROFESSOR],
      });

      const res = await login('con.extra@alumnos.ucn.cl').expect(200);
      expect(res.body.user.roles.sort()).toEqual([Role.PROFESSOR, Role.STUDENT].sort());

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: alumno.id } });
      expect(stored.roles).toContain(Role.PROFESSOR);
      expect(stored.role).toBe(Role.PROFESSOR);
    });

    it('enlaza el googleId en el primer login de una cuenta pre-registrada por CSV', async () => {
      const alumno = await createUser(prisma, {
        email: 'precargado@alumnos.ucn.cl',
        roles: [Role.STUDENT],
        googleId: null,
      });

      await login('precargado@alumnos.ucn.cl').expect(200);

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: alumno.id } });
      expect(stored.googleId).toBe('google-precargado@alumnos.ucn.cl');
    });

    it('una cuenta deshabilitada no puede iniciar sesión', async () => {
      await createUser(prisma, {
        email: 'suspendido@alumnos.ucn.cl',
        roles: [Role.STUDENT],
        isActive: false,
      });

      await login('suspendido@alumnos.ucn.cl').expect(403);
    });

    it('rechaza un correo de Google sin verificar', async () => {
      await login('sin.verificar@alumnos.ucn.cl', { emailVerified: false }).expect(401);
    });

    it('rechaza un idToken que Google no valida', async () => {
      await anonymous(app)
        .post('/api/auth/google')
        .send({ idToken: invalidGoogleIdToken() })
        .expect(401);
    });
  });

  describe('protección de las rutas', () => {
    it('/auth/me exige un token válido', async () => {
      await anonymous(app).get('/api/auth/me').expect(401);
      await withToken(app, 'token-inventado').get('/api/auth/me').expect(401);
    });

    it('/auth/me devuelve el usuario autenticado con todos sus roles', async () => {
      const usuario = await createUser(prisma, {
        email: 'multi@alumnos.ucn.cl',
        roles: [Role.STUDENT, Role.ADMIN],
      });

      const res = await as(app, usuario).get('/api/auth/me').expect(200);

      expect(res.body).toMatchObject({ id: usuario.id, email: 'multi@alumnos.ucn.cl' });
      expect(res.body.roles.sort()).toEqual([Role.ADMIN, Role.STUDENT].sort());
    });

    it('un token cuyo usuario ya no existe queda invalidado', async () => {
      await withToken(app, signTokenForMissingUser()).get('/api/auth/me').expect(401);
    });

    it('deshabilitar la cuenta invalida los tokens ya emitidos', async () => {
      const alumno = await createStudent(prisma);
      const agente = as(app, alumno);
      await agente.get('/api/auth/me').expect(200);

      await prisma.user.update({ where: { id: alumno.id }, data: { isActive: false } });

      // El JWT sigue siendo criptográficamente válido: el rechazo viene de recargar
      // el usuario desde la base en cada request.
      await agente.get('/api/auth/me').expect(401);
    });

    it('un alumno no puede entrar a las rutas de administración', async () => {
      const alumno = await createStudent(prisma);
      await as(app, alumno).get('/api/users').expect(403);
    });

    it('un administrador sí puede', async () => {
      const admin = await createAdmin(prisma);
      await as(app, admin).get('/api/users').expect(200);
    });
  });

  describe('prefijo global de la API', () => {
    it('/health responde SIN prefijo (lo consultan los health checks de Azure)', async () => {
      await anonymous(app).get('/health').expect(200, { status: 'ok' });
    });

    it('el resto de la API vive bajo /api', async () => {
      await anonymous(app).get('/auth/me').expect(404);
    });
  });
});
