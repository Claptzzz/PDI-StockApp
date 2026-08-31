/** Valores que el contenedor puede inyectar en `public/config.js` al arrancar. */
export interface AppRuntimeConfig {
  googleClientId?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppRuntimeConfig;
  }
}

/**
 * Config de runtime con fallback a la de build.
 *
 * Prioridad: `window.__APP_CONFIG__` (generado por el entrypoint de nginx) y, si no
 * está, la variable `VITE_*` embebida en el bundle. Así el despliegue con Docker
 * cambia valores sin reconstruir, y Vercel/dev siguen funcionando igual que antes.
 */
export const runtimeConfig: Required<AppRuntimeConfig> = {
  googleClientId:
    window.__APP_CONFIG__?.googleClientId?.trim() ||
    (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''),
};

/**
 * URL base de la API.
 *
 * - Con `VITE_API_URL` (Vercel → Azure): URL absoluta del backend + el prefijo.
 * - Sin ella (Docker + nginx): ruta RELATIVA bajo el mismo origen, que nginx
 *   redirige al backend. Al ser el mismo origen no hace falta CORS.
 *
 * El prefijo debe coincidir con `API_PREFIX` del backend (ambos por defecto "api").
 * `VITE_API_PREFIX=""` lo desactiva, para hablar con un backend que sirva en la raíz.
 *
 * `import.meta.env.BASE_URL` ya incluye la barra final ('/' o '/inventario/').
 */
export function resolveApiBaseUrl(): string {
  const prefix = (import.meta.env.VITE_API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, '');
  const absolute = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');

  if (absolute) {
    return prefix ? `${absolute}/${prefix}` : absolute;
  }
  // BASE_URL termina en '/', así que concatenar basta; sin prefijo hay que quitarla
  // para no dejar una barra final que axios duplicaría.
  return prefix
    ? `${import.meta.env.BASE_URL}${prefix}`
    : import.meta.env.BASE_URL.replace(/\/$/, '');
}
