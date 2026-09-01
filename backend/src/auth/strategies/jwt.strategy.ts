import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from '../interfaces/auth.types';
import { effectiveRoles, primaryRole } from '../role.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Recarga el usuario desde la DB en cada request para reflejar cambios. */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no válido o cuenta deshabilitada');
    }

    // `roles` es la fuente de verdad; si por algún motivo llegara vacío (fila previa
    // al backfill), se cae al rol principal para no dejar al usuario sin permisos.
    const roles = effectiveRoles(user);

    return {
      id: user.id,
      email: user.email,
      roles,
      role: primaryRole(roles) ?? user.role,
    };
  }
}
