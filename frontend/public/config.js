/*
 * Configuración de RUNTIME.
 *
 * Este archivo por defecto es un NO-OP: en desarrollo y en Vercel los valores se
 * inyectan en tiempo de build (VITE_*). En el despliegue con Docker + nginx, el
 * entrypoint del contenedor SOBRESCRIBE este archivo con los valores reales, de
 * modo que cambiar el Client ID de Google no exige reconstruir la imagen.
 *
 * nginx lo sirve con `no-store` para que un cambio se vea en la siguiente recarga.
 */
window.__APP_CONFIG__ = {
  // googleClientId: 'xxxxx.apps.googleusercontent.com',
};
