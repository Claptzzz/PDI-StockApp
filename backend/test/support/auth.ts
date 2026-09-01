import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import request from 'supertest';
import type { JwtPayload } from '../../src/auth/interfaces/auth.types';
import { primaryRole } from '../../src/auth/role.util';
import { JWT_SECRET } from './env';

/** Mismo secreto y mismo emisor que usa la app (`@nestjs/jwt`), sin dependencias extra. */
const jwt = new JwtService({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } });

/**
 * El login real exige un idToken de Google, así que para el resto de la suite se
 * firman JWT propios con el MISMO secreto que valida `JwtStrategy`. No es un atajo
 * que salte la autenticación: el token pasa por passport-jwt y por la recarga del
 * usuario desde la base, exactamente como en producción.
 */
export function signToken(user: Pick<User, 'id' | 'email' | 'roles' | 'role'>): string {
  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    roles,
    role: primaryRole(roles) ?? user.role,
  };
  return jwt.sign(payload);
}

/** Token de un usuario que ya no existe en la base (debe dar 401). */
export function signTokenForMissingUser(): string {
  const payload: JwtPayload = {
    sub: 'usuario-inexistente',
    email: 'fantasma@ucn.cl',
    roles: [Role.ADMIN],
    role: Role.ADMIN,
  };
  return jwt.sign(payload);
}

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
export type Agent = Record<Method, (url: string) => request.Test> & { token: string };

/**
 * Agente supertest con el Bearer de `user` ya puesto:
 *
 *   await as(app, profesor).post(`/api/courses/${id}/groups`).send({ name: 'G1' }).expect(201);
 */
export function as(
  app: INestApplication,
  user: Pick<User, 'id' | 'email' | 'roles' | 'role'>,
): Agent {
  return withToken(app, signToken(user));
}

/** Igual que `as`, pero con un token arbitrario (o ninguno). */
export function withToken(app: INestApplication, token?: string): Agent {
  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const build =
    (method: Method) =>
    (url: string): request.Test => {
      const test = request(server)[method](url);
      return token ? test.set('Authorization', `Bearer ${token}`) : test;
    };

  return {
    get: build('get'),
    post: build('post'),
    patch: build('patch'),
    put: build('put'),
    delete: build('delete'),
    token: token ?? '',
  };
}

/** Agente anónimo (sin Authorization). */
export function anonymous(app: INestApplication): Agent {
  return withToken(app);
}
