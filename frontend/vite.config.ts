import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  // Prefijo bajo el que se sirve la app. Default '/' = raíz (Vercel, dev), que es
  // el comportamiento de siempre. El despliegue con nginx lo fija a '/inventario/'
  // en tiempo de build (ARG VITE_BASE_PATH del Dockerfile).
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: { 
    port: 5174, 
    strictPort: true,
     headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },
});
