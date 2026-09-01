/**
 * Se ejecuta en cada worker ANTES de cargar el archivo de test.
 *
 * Aquí viven los DOS únicos mocks de la suite. Se declaran en el setup (y no en cada
 * spec) para que ningún test pueda olvidarse de mockearlos y acabar llamando a un
 * servicio externo de verdad.
 *
 * Las variables de entorno NO se aplican aquí sino en `setup/apply-env.ts`, que corre
 * en el hook `setupFiles`, más temprano (ver el comentario de ese archivo).
 */

// Único servicio externo del login: la verificación del idToken contra Google.
jest.mock('google-auth-library', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../mocks/google.mock').googleAuthLibraryMock as unknown;
});

// Único servicio externo de las fotos de préstamo: Supabase Storage.
jest.mock('@supabase/supabase-js', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../mocks/supabase.mock').supabaseJsMock as unknown;
});
