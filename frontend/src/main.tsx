import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App.tsx';
import { queryClient } from '@/lib/queryClient';
import { runtimeConfig } from '@/lib/runtimeConfig';
import '@/index.css';

const googleClientId = runtimeConfig.googleClientId;

// `BASE_URL` es el prefijo del despliegue ('/' o '/inventario/'). React Router
// espera el basename SIN barra final.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={basename}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
