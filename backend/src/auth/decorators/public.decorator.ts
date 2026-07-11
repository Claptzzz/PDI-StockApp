import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta como pública para que `JwtAuthGuard` no la proteja. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
