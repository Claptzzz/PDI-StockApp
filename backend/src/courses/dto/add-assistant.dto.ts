import { IsEmail } from 'class-validator';

export class AddAssistantDto {
  @IsEmail()
  email: string;
}
