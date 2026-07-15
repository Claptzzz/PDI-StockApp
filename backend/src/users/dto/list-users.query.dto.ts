import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  search?: string;
}
