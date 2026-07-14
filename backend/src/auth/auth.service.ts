import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
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
  private readonly oauthClient: OAuth2Client;
  private readonly googleClientId: string;
  private readonly adminEmails: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.googleClientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.oauthClient = new OAuth2Client(this.googleClientId);
    this.adminEmails = (config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  async loginWithGoogle(idToken: string): Promise<GoogleLoginResult> {
    const payload = await this.verifyGoogleToken(idToken);

    const email = payload.email?.trim().toLowerCase();
    if (!email || payload.email_verified !== true) {
      throw new UnauthorizedException('El correo de Google no está verificado');
    }
    const name = payload.name?.trim() || email;

    const derivedRole = resolveRole(email, this.adminEmails);
    if (derivedRole === null) {
      throw new ForbiddenException('Correo institucional no válido');
    }

    const user = await this.linkOrCreateUser(email, name, derivedRole, payload.sub);

    const jwtPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(jwtPayload);

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  /** Verifica el idToken contra Google. Cualquier fallo se traduce a 401. */
  private async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('idToken de Google inválido');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
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
        throw new ForbiddenException('Cuenta deshabilitada');
      }

      const data: { googleId?: string; role?: Role } = {};
      // Enlaza el googleId en el primer login si aún no estaba.
      if (!existing.googleId) {
        data.googleId = googleId;
      }
      // Promueve a ADMIN si el correo entró al allowlist (nunca degrada un rol).
      if (derivedRole === Role.ADMIN && existing.role !== Role.ADMIN) {
        data.role = Role.ADMIN;
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
