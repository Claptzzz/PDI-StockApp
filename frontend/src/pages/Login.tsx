import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { dashboardPath, primaryRole, userRoles, type User } from '@/lib/types';
import ucnLogo from '@/assets/UCN_y_texto.png';

interface GoogleLoginResponse {
  accessToken: string;
  user: User;
}

export function Login() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handlers memoizados: evita que <GoogleLogin> re-inicialice GSI en cada render.
  const handleSuccess = useCallback(
    async (credentialResponse: CredentialResponse) => {
      const idToken = credentialResponse.credential;
      // Con FedCM/COOP el credential puede venir vacío: no llamamos al backend con un token inválido.
      if (!idToken) {
        setError('No se recibió el token de Google. Refresca la página e intenta nuevamente.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post<GoogleLoginResponse>('/auth/google', { idToken });
        setSession(data.accessToken, data.user);
        const home = primaryRole(userRoles(data.user)) ?? data.user.role;
        navigate(dashboardPath(home), { replace: true });
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const backendMsg = (err.response?.data as { message?: string } | undefined)?.message;
          if (status === 403) {
            setError(backendMsg ?? 'Tu cuenta no está habilitada o el correo no es institucional.');
          } else if (status === 401) {
            setError(backendMsg ?? 'No se pudo verificar tu identidad con Google.');
          } else {
            setError('Ocurrió un error al iniciar sesión. Intenta nuevamente.');
          }
        } else {
          setError('Ocurrió un error inesperado.');
        }
      } finally {
        setLoading(false);
      }
    },
    [navigate, setSession],
  );

  const handleError = useCallback(() => {
    // El SDK no entrega detalle del error; dejamos rastro para depurar (COOP/FedCM, popup bloqueado, etc.).
    console.error('[GoogleLogin] onError: falló el flujo de Google Identity Services.');
    setError('No se pudo iniciar sesión con Google. Revisa el bloqueo de ventanas emergentes e intenta de nuevo.');
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-surface-page px-4">
      <div className="w-full max-w-md">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-card p-8 shadow-sm">
          <div className="flex flex-col items-center gap-6">
            <img src={ucnLogo} alt="Universidad Católica del Norte" className="h-20 w-auto" />

            <div className="text-center">
              <h1 className="text-2xl font-bold text-text-primary">Préstamo de Kits Arduino</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Inicia sesión con tu cuenta institucional UCN
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="w-full rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                {error}
              </div>
            )}

            <div className="flex min-h-[44px] w-full flex-col items-center justify-center gap-2">
              {loading && <span className="text-sm text-text-muted">Verificando…</span>}
              <div className={loading ? 'pointer-events-none opacity-50' : undefined}>
                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={handleError}
                  shape="rectangular"
                  text="signin_with"
                />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          Universidad Católica del Norte · Escuela de Ingeniería
        </p>
      </div>
    </div>
  );
}

export default Login;
