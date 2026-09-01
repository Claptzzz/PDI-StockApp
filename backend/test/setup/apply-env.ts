/**
 * Hook `setupFiles`: el punto MÁS TEMPRANO del worker de Jest. Corre antes del framework
 * de test, antes de `setupFilesAfterEnv` y —lo importante— antes de que se cargue el
 * archivo de test y, con él, `src/app.module.ts`.
 *
 * Ese orden es el requisito: `ConfigModule.forRoot()` vive en el argumento del decorador
 * `@Module`, así que valida `process.env` en cuanto el módulo se importa. Si el entorno
 * se aplicara después, la app no arrancaría en cualquier máquina sin `.env` (que es
 * exactamente el caso de CI).
 */
import { applyTestEnv } from '../support/env';

applyTestEnv();
