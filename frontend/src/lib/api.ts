import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { queryClient } from '@/lib/queryClient';
import { resolveApiBaseUrl } from '@/lib/runtimeConfig';

/**
 * Cliente HTTP base para la API del backend.
 * Ver `resolveApiBaseUrl`: absoluta con VITE_API_URL, relativa al mismo origen si no.
 */
export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Agrega el Bearer token desde el store en cada request (si existe).
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si el backend responde 401 (sesión expirada/ inválida), cierra sesión y va a /login.
// Se excluye el endpoint de login, cuyos 401/403 los maneja la propia pantalla.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const url = error.config?.url ?? '';
      const isLoginRequest = url.includes('/auth/google');

      if (status === 401 && !isLoginRequest) {
        useAuthStore.getState().logout();
        // `assign` no pasa por el router, así que hay que anteponer el prefijo del
        // despliegue a mano; si no, bajo /inventario/ saltaría fuera de la app.
        const loginPath = `${import.meta.env.BASE_URL}login`;
        if (window.location.pathname !== loginPath) {
          window.location.assign(loginPath);
        }
      }

      // Un 403 puede deberse a un contexto desincronizado (p.ej. ayudante desactivado):
      // refresca /me/contexts para que el dashboard del estudiante se reacomode.
      if (status === 403) {
        void queryClient.invalidateQueries({ queryKey: ['me', 'contexts'] });
      }
    }
    return Promise.reject(error);
  },
);
