import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  /** idToken de Google obtenido en el frontend (Google Identity Services). */
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
