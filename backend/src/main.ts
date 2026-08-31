import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /*
   * Prefijo global de la API. Default 'api' para que el despliegue con nginx pueda
   * distinguir las llamadas del backend de los assets del SPA bajo el mismo origen.
   *
   * `health` queda EXCLUIDO a propósito: sigue respondiendo en `/health` sin prefijo,
   * que es lo que consultan el smoke test del workflow de Azure y los health checks
   * del propio App Service. Así este cambio no rompe el despliegue existente.
   * (En el compose, nginx mapea /inventario/api/health -> backend /health.)
   *
   * API_PREFIX='' desactiva el prefijo y deja las rutas como antes de la Fase 12.
   */
  const apiPrefix = (process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, '');
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix, {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });
  }

  /*
   * CORS solo hace falta cuando el front vive en otro origen (Vercel -> Azure). En el
   * despliegue con Docker el SPA y la API comparten origen a través de nginx, así que
   * FRONTEND_ORIGIN puede quedar vacío y no se habilita CORS.
   */
  const origins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Azure App Service / contenedores inyectan PORT; escuchar en 0.0.0.0 para el host.
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
