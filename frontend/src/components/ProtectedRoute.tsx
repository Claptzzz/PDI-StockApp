import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * Protege las rutas privadas. Si no hay sesión → /login. Al montar, si hay token
 * persistido, valida la sesión contra GET /auth/me (si falla, cierra sesión).
 */
export function ProtectedRoute() {
  const { isAuthenticated, accessToken, logout } = useAuth();
  const [validating, setValidating] = useState<boolean>(Boolean(accessToken));

  useEffect(() => {
    // Sin token, `validating` ya nace en false (estado inicial); no hay nada que validar.
    if (!accessToken) {
      return;
    }
    let active = true;
    api
      .get('/auth/me')
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setValidating(false);
      });
    return () => {
      active = false;
    };
    // Solo se valida una vez al montar la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (validating) {
    return (
      <div className="grid min-h-screen place-items-center text-text-muted">
        Verificando sesión…
      </div>
    );
  }

  return <Outlet />;
}
