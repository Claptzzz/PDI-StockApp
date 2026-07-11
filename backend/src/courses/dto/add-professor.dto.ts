import { IsEmail } from 'class-validator';

export class AddProfessorDto {
  @IsEmail()
  email: string;
}
