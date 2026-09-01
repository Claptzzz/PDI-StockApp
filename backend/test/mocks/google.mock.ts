/**
 * Mock de `google-auth-library` (único servicio externo del login).
 *
 * En vez de guardar estado mutable compartido, el "idToken" de test ES el payload:
 * `googleIdToken({...})` lo serializa en base64url y el mock lo deserializa. Así los
 * tests no dependen del orden ni de resetear un mock entre casos.
 */
import type { TokenPayload } from 'google-auth-library';

export interface FakeGooglePayload {
  email: string;
  name?: string;
  /** Google marca los correos no confirmados; el backend debe rechazarlos. */
  email_verified?: boolean;
  /** `sub` = identificador estable de la cuenta Google. */
  sub?: string;
}

/** Construye el idToken falso que el mock sabe leer. */
export function googleIdToken(payload: FakeGooglePayload): string {
  const full = {
    email: payload.email,
    name: payload.name ?? payload.email,
    email_verified: payload.email_verified ?? true,
    sub: payload.sub ?? `google-${payload.email}`,
  };
  return Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
}

/** idToken que el mock no puede verificar (simula firma inválida / expirado). */
export function invalidGoogleIdToken(): string {
  return 'no-es-un-token-de-google';
}

class FakeOAuth2Client {
  constructor(private readonly clientId?: string) {}

  verifyIdToken({ idToken }: { idToken: string; audience?: string | string[] }) {
    let payload: TokenPayload;
    try {
      payload = JSON.parse(Buffer.from(idToken, 'base64url').toString('utf8')) as TokenPayload;
    } catch {
      throw new Error('Invalid token signature');
    }
    if (!payload || typeof payload.email !== 'string') {
      throw new Error('Invalid token payload');
    }
    return Promise.resolve({ getPayload: () => payload });
  }
}

/** Objeto que sustituye al módulo completo en `jest.mock`. */
export const googleAuthLibraryMock = { OAuth2Client: FakeOAuth2Client };
