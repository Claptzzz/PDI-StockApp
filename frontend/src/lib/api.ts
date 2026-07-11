import axios from 'axios';

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
