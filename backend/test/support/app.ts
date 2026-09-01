import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { API_PREFIX } from './env';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

/**
 * Levanta la aplicación REAL (todos los módulos, guards globales y ValidationPipe)
 * replicando el bootstrap de `src/main.ts`, incluido el prefijo global de la API y la
 * exclusión de `GET /health`. Los tests golpean las mismas rutas que producción.
 *
 * Solo están mockeados los dos servicios verdaderamente externos (Google y Supabase),
 * vía `jest.mock` en `test/setup/jest.setup.ts`.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/**
 * Vacía TODAS las tablas de datos entre tests.
 *
 * Se eligió TRUNCATE ... CASCADE en vez de "una transacción por test con rollback"
 * porque los tests atraviesan HTTP real: el handler abre sus propias conexiones del
 * pool de Prisma y no hay forma de inyectarles la transacción del test sin sustituir
 * el PrismaService por un doble, que es justo lo que esta suite quiere evitar. Además
 * varios flujos usan `$transaction` internamente y anidarlos falsearía el aislamiento.
 *
 * `CASCADE` resuelve el orden de las FKs y `RESTART IDENTITY` deja los contadores
 * limpios. El resultado es que cada test arranca con la base vacía: no hay estado
 * compartido ni dependencias de orden.
 */
export async function resetDb(prisma: PrismaService): Promise<void> {
  const schema = schemaFromUrl(process.env.DATABASE_URL ?? '');
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename NOT LIKE '\\_prisma%'`,
    schema,
  );
  if (tables.length === 0) return;

  const list = tables.map((t) => `"${schema}"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Esquema declarado en la URL (`?schema=...`); `public` si no viene. */
export function schemaFromUrl(url: string): string {
  const match = /[?&]schema=([^&]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : 'public';
}
