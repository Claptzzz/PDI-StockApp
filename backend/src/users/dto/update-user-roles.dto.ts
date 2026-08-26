import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRolesDto {
  /** Conjunto completo de roles: reemplaza el actual, no se acumula. */
  @IsArray()
  @ArrayNotEmpty({ message: 'El usuario debe tener al menos un rol' })
  @IsEnum(Role, { each: true, message: 'Rol inválido' })
  roles: Role[];
}
