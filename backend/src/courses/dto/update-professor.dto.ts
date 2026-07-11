import { IsBoolean } from 'class-validator';

export class UpdateProfessorDto {
  @IsBoolean()
  authorized: boolean;
}
