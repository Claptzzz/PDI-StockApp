import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { applyTestEnv, testDatabaseUrl } from './support/env';
import { schemaFromUrl } from './support/app';

const BACKEND_ROOT = join(__dirname, '..');

/**
 * Se ejecuta UNA vez antes de toda la suite:
 *   1. fija las variables de entorno de test,
 *   2. crea la base si no existe (comodidad en local; en CI la crea el service container),
 *   3. aplica las migraciones con `prisma migrate deploy` (nunca `migrate dev`:
 *      es interactivo y no debe generar migraciones nuevas desde los tests).
 */
export default async function globalSetup(): Promise<void> {
  applyTestEnv();
  const url = testDatabaseUrl();

  assertNotDevDatabase(url);
  await ensureDatabaseExists(url);

  execFileSync(prismaBin(), ['migrate', 'deploy'], {
    cwd: BACKEND_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}

/** Ruta al binario de Prisma instalado (evita depender de `npx` y de la red). */
function prismaBin(): string {
  const bin = join(BACKEND_ROOT, 'node_modules', '.bin', 'prisma');
  if (!existsSync(bin)) {
    throw new Error('No se encontró node_modules/.bin/prisma. Ejecuta `npm ci` en /backend.');
  }
  return bin;
}

/**
 * Barrera de seguridad: la suite hace TRUNCATE de todo, así que se niega a correr
 * contra una base que no se identifique como de test.
 */
function assertNotDevDatabase(url: string): void {
  const database = databaseName(url);
  const schema = schemaFromUrl(url);
  const looksLikeTest = /test/i.test(database) || /test/i.test(schema);
  if (!looksLikeTest) {
    throw new Error(
      `TEST_DATABASE_URL apunta a "${database}" (schema "${schema}"), que no parece una base de ` +
        'test. Usa una base o un schema con "test" en el nombre: la suite BORRA todas las tablas.',
    );
  }
}

/** `CREATE DATABASE` conectándose a la base de mantenimiento del mismo servidor. */
async function ensureDatabaseExists(url: string): Promise<void> {
  const target = databaseName(url);
  const adminUrl = withDatabase(url, 'postgres');
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });

  try {
    const rows = await admin.$queryRawUnsafe<{ exists: number }[]>(
      'SELECT 1 as exists FROM pg_database WHERE datname = $1',
      target,
    );
    if (rows.length === 0) {
      // CREATE DATABASE no admite parámetros ni transacción: se interpola el nombre
      // ya validado por la URL, entre comillas dobles.
      await admin.$executeRawUnsafe(`CREATE DATABASE "${target.replace(/"/g, '""')}"`);
      console.log(`[e2e] base de test "${target}" creada`);
    }
  } catch (error) {
    // Si el usuario no puede crear bases, el `migrate deploy` de abajo dará el error
    // concreto; aquí solo se avisa para no enmascararlo.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[e2e] no se pudo verificar/crear la base "${target}": ${message}`);
  } finally {
    await admin.$disconnect();
  }
}

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  parsed.search = '';
  return parsed.toString();
}
