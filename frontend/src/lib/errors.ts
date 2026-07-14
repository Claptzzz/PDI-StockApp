import axios from 'axios';

/** Extrae un mensaje legible desde un error de la API (formato de NestJS). */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error inesperado.',
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const message = data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}
