import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { queryClient } from '@/lib/queryClient';

/**
 * Cliente HTTP base para la API del backend.
 * La URL se toma de la variable de entorno `VITE_API_URL`.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
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
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
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
