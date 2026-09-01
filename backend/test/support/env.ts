/**
 * Entorno de la suite e2e. Se importa desde `global-setup.ts` y desde el setup de
 * cada worker, ANTES de construir la app, porque varios services leen la config en
 * su constructor (ADMIN_EMAILS en AuthService/CoursesService/GroupsService).
 *
 * Los valores son FIJOS y viven aquí (no en un .env) para que los tests que dependen
 * de ellos —los allowlists de roles, sobre todo— se lean sin saltar a otro archivo.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lee `backend/.env.test` (git-ignored) sin depender de `dotenv`. Las variables ya
 * presentes en el entorno GANAN, para que CI pueda inyectar la suya.
 */
function loadEnvTestFile(): void {
  const file = join(__dirname, '..', '..', '.env.test');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

/**
 * Los ALLOWLISTS están fijados aquí a propósito y NO se pueden sobrescribir desde el
 * entorno: varios tests afirman sobre correos concretos de estas listas
 * (`alumno.admin@alumnos.ucn.cl` debe resolver [STUDENT, ADMIN]). Si CI pudiera
 * cambiarlas, la suite fallaría por configuración y no por una regresión real.
 */
export const ADMIN_EMAILS = 'admin.test@ucn.cl,alumno.admin@alumnos.ucn.cl';
export const PROFESSOR_EMAILS = 'externo.test@gmail.com,ayudante.profe@alumnos.ucn.cl';

/** Prefijo global de la API, igual que en producción (Fase 12). */
export const API_PREFIX = 'api';

/**
 * El resto sí acepta lo que traiga el entorno (CI define sus propios valores dummy).
 * Los tests firman sus JWT con ESTE mismo valor, así que da igual cuál sea mientras
 * app y helper compartan el secreto.
 */
loadEnvTestFile();
export const JWT_SECRET = envOr('JWT_SECRET', 'test-jwt-secret-con-mas-de-16-chars');
const GOOGLE_CLIENT_ID = envOr('GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
const GOOGLE_CLIENT_SECRET = envOr('GOOGLE_CLIENT_SECRET', 'test-client-secret');
const SUPABASE_URL = envOr('SUPABASE_URL', 'http://supabase.test');
const SUPABASE_SERVICE_ROLE_KEY = envOr('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
const SUPABASE_BUCKET = envOr('SUPABASE_BUCKET', 'test-bucket');

function envOr(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value ? value : fallback;
}

/**
 * Base de datos de test. SIEMPRE distinta de la de desarrollo: la suite hace
 * TRUNCATE de todas las tablas entre tests.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL. Crea backend/.env.test a partir de backend/.env.test.example ' +
        '(la suite e2e nunca debe apuntar a la base de desarrollo).',
    );
  }
  return url;
}

/** Aplica todas las variables que la app necesita para arrancar en modo test. */
export function applyTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testDatabaseUrl();
  delete process.env.DIRECT_URL;
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.API_PREFIX = API_PREFIX;
  process.env.ADMIN_EMAILS = ADMIN_EMAILS;
  process.env.PROFESSOR_EMAILS = PROFESSOR_EMAILS;
  // Google y Supabase están mockeados: solo necesitan pasar la validación de env.
  process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET;
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_BUCKET = SUPABASE_BUCKET;
  // Sin CORS: la suite golpea el handler directamente.
  process.env.FRONTEND_ORIGIN = '';
}
