import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/store/toast';

interface RedirectWithToastProps {
  to: string;
  message: string;
  tone?: 'error' | 'success';
}

/**
 * Redirige mostrando un aviso. El toast se dispara en un efecto y no durante el
 * render: llamarlo en el cuerpo del componente actualiza el store del Toaster
 * mientras React está renderizando otro componente (warning de React).
 */
export function RedirectWithToast({ to, message, tone = 'error' }: RedirectWithToastProps) {
  const toast = useToast();
  // StrictMode monta dos veces en desarrollo: evita el toast duplicado.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    if (tone === 'error') toast.error(message);
    else toast.success(message);
  }, [toast, message, tone]);

  return <Navigate to={to} replace />;
}
