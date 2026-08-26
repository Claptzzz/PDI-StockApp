import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AcceptTermsDto {
  /**
   * Versión del texto que el alumno tenía en pantalla. Si no coincide con la
   * vigente, el backend rechaza con 409 (el texto cambió mientras leía).
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  termsVersion: string;
}
