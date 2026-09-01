/*
 * ⚠️ Este módulo importa `AppModule`, y con ello dispara `ConfigModule.forRoot()`, que
 * valida `process.env` en cuanto el módulo se carga. NO lo importes desde
 * `global-setup.ts` ni desde ningún sitio que corra antes de `applyTestEnv()`.
 */
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { API_PREFIX, schemaFromUrl } from './env';

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

  const prisma = app.get(PrismaService);
  await assertConnectedToTestDatabase(prisma);

  return { app, prisma };
}

/**
 * Segunda barrera de seguridad, complementaria a la de `global-setup.ts`.
 *
 * Aquella comprueba `TEST_DATABASE_URL`; esta comprueba a qué base está conectada
 * REALMENTE la app, que es la que `resetDb` va a truncar. Son cosas distintas: el
 * cliente de Prisma resuelve su URL desde `process.env.DATABASE_URL` al arrancar, y si
 * un `.env` de desarrollo llegara a ganar esa precedencia, la suite borraría la base
 * equivocada sin que la primera barrera se enterase.
 */
async function assertConnectedToTestDatabase(prisma: PrismaService): Promise<void> {
  const [row] = await prisma.$queryRawUnsafe<{ db: string; schema: string }[]>(
    'SELECT current_database() AS db, current_schema() AS schema',
  );
  const looksLikeTest = /test/i.test(row?.db ?? '') || /test/i.test(row?.schema ?? '');

  if (!looksLikeTest) {
    await prisma.$disconnect();
    throw new Error(
      `La app de test quedó conectada a la base "${row?.db}" (schema "${row?.schema}"), que no ` +
        'parece de test. Revisa que applyTestEnv() se ejecute antes de cargar AppModule: ' +
        'la suite trunca TODAS las tablas de la base a la que esté conectada.',
    );
  }
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
 *
 * Que la base sea la de TEST lo garantiza `assertConnectedToTestDatabase`, que corre
 * en `createTestApp` antes de que este borrado pueda ejecutarse.
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
