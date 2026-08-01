import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/auth.types';
import { resolveRole } from './role.util';

export interface GoogleLoginResult {
  accessToken: string;
  user: { id: string; email: string; name: string; role: Role };
}

@Injectable()
export class AuthService {
  // TODO: [AUTH_DEBUG] logging temporal para diagnosticar el 401 — quitar después.
  private readonly logger = new Logger(AuthService.name);
  private readonly oauthClient: OAuth2Client;
  private readonly googleClientId: string;
  private readonly adminEmails: string[];
  private readonly professorEmails: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.googleClientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.oauthClient = new OAuth2Client(this.googleClientId);
    this.adminEmails = parseEmailList(config.get<string>('ADMIN_EMAILS'));
    this.professorEmails = parseEmailList(config.get<string>('PROFESSOR_EMAILS'));
  }

  async loginWithGoogle(idToken: string): Promise<GoogleLoginResult> {
    const payload = await this.verifyGoogleToken(idToken);

    const email = payload.email?.trim().toLowerCase();
    if (!email || payload.email_verified !== true) {
      this.logger.error(
        `[AUTH_DEBUG] RECHAZO 401 email_verified: email=${String(email)} · email_verified=${String(payload.email_verified)}`,
      );
      throw new UnauthorizedException('El correo de Google no está verificado');
    }
    const name = payload.name?.trim() || email;

    const derivedRole = resolveRole(email, this.adminEmails, this.professorEmails);
    this.logger.error(
      `[AUTH_DEBUG] resolveRole(${email}) = ${String(derivedRole)} · adminEmails=${JSON.stringify(this.adminEmails)} · professorEmails=${JSON.stringify(this.professorEmails)}`,
    );
    if (derivedRole === null) {
      this.logger.error(`[AUTH_DEBUG] RECHAZO 403 dominio no reconocido para email=${email}`);
      throw new ForbiddenException('Correo institucional no válido');
    }

    const user = await this.linkOrCreateUser(email, name, derivedRole, payload.sub);
    this.logger.error(
      `[AUTH_DEBUG] LOGIN OK · userId=${user.id} · email=${user.email} · role=${user.role}`,
    );

    const jwtPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(jwtPayload);

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  /** Verifica el idToken contra Google. Cualquier fallo se traduce a 401. */
  private async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    this.logger.error(
      `[AUTH_DEBUG] verifyIdToken IN · idTokenLength=${idToken?.length ?? 0} · GOOGLE_CLIENT_ID(env)=${process.env.GOOGLE_CLIENT_ID ?? '(undefined)'} · audienceUsed=${this.googleClientId} · NODE_ENV=${process.env.NODE_ENV ?? '(undefined)'}`,
    );
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        this.logger.error('[AUTH_DEBUG] verifyIdToken OK pero getPayload() devolvió vacío');
        throw new UnauthorizedException('idToken de Google inválido');
      }
      this.logger.error(
        `[AUTH_DEBUG] verify OK · email=${payload.email} · aud=${JSON.stringify(payload.aud)} · iss=${payload.iss} · email_verified=${String(payload.email_verified)} · sub=${payload.sub} · exp=${payload.exp} · now=${Math.floor(Date.now() / 1000)}`,
      );
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AUTH_DEBUG] verifyIdToken LANZÓ excepción: ${message}`);
      if (error instanceof Error && error.stack) {
        this.logger.error(`[AUTH_DEBUG] stack: ${error.stack}`);
      }
      throw new UnauthorizedException('idToken de Google inválido');
    }
  }

  /**
   * Enlaza el login de Google a un User existente o lo crea.
   * - Si existe con `googleId` null, lo enlaza (primer login de una cuenta
   *   pre-registrada por seed/CSV).
   * - Nunca degrada el rol de un usuario existente (protege a un ADMIN sembrado).
   * - Rechaza cuentas deshabilitadas.
   */
  private async linkOrCreateUser(
    email: string,
    name: string,
    derivedRole: Role,
    googleId: string,
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (!existing.isActive) {
        this.logger.error(
          `[AUTH_DEBUG] RECHAZO 403 cuenta deshabilitada · userId=${existing.id} · email=${email}`,
        );
        throw new ForbiddenException('Cuenta deshabilitada');
      }

      const data: { googleId?: string; role?: Role } = {};
      // Enlaza el googleId en el primer login si aún no estaba.
      if (!existing.googleId) {
        data.googleId = googleId;
      }
      // Promueve si el rol derivado por los allowlists es más fuerte que el actual.
      // Orden de fuerza: ADMIN > PROFESSOR > STUDENT. Nunca degrada.
      if (ROLE_RANK[derivedRole] > ROLE_RANK[existing.role]) {
        data.role = derivedRole;
      }

      if (Object.keys(data).length > 0) {
        return this.prisma.user.update({ where: { id: existing.id }, data });
      }

      return existing;
    }

    return this.prisma.user.create({
      data: { email, name, role: derivedRole, googleId },
    });
  }
}

const ROLE_RANK: Record<Role, number> = {
  [Role.STUDENT]: 1,
  [Role.PROFESSOR]: 2,
  [Role.ADMIN]: 3,
};

function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
