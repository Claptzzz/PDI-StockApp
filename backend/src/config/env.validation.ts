import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Esquema de las variables de entorno de la aplicación.
 * Se valida al arrancar; si algo falta o es inválido, el proceso no inicia.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  /**
   * Conexión directa a la DB (sin pooler) para las migraciones. Opcional: si no está,
   * Prisma usa DATABASE_URL. Necesaria en prod si la DB va detrás de un pooler
   * (Neon/Supabase/pgBouncer).
   */
  @IsOptional()
  @IsString()
  DIRECT_URL?: string;

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET debe tener al menos 16 caracteres' })
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_SECRET: string;

  /** Lista de correos de administradores separada por comas. */
  @IsString()
  @IsNotEmpty()
  ADMIN_EMAILS: string;

  /** Lista opcional de correos con rol PROFESSOR (p.ej. profes con correo no institucional). */
  @IsOptional()
  @IsString()
  PROFESSOR_EMAILS?: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_BUCKET: string;

  /**
   * Origen(es) permitido(s) para CORS. Puede ser una lista separada por comas
   * (dominio de prod + localhost).
   *
   * OPCIONAL desde la Fase 12: en el despliegue autocontenido (Docker + nginx) el
   * SPA y la API comparten origen, así que no hay CORS que configurar y se deja
   * vacío. Sigue siendo necesario cuando el front vive en otro dominio
   * (Vercel -> Azure), donde su ausencia bloquearía todas las llamadas.
   */
  @IsOptional()
  @IsString()
  FRONTEND_ORIGIN?: string;

  /**
   * Prefijo global de las rutas de la API ("api" por defecto). `GET /health` queda
   * siempre fuera del prefijo, por compatibilidad con los health checks de Azure.
   */
  @IsOptional()
  @IsString()
  API_PREFIX?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Validación de variables de entorno fallida:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
