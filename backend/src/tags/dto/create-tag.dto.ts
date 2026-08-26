import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Hex de 3 o 6 dígitos, con almohadilla (ej. #166499, #fff). */
export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** String vacío → null (para poder "limpiar" el color desde el formulario). */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export class CreateTagDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la etiqueta es obligatorio' })
  @MaxLength(60)
  name: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'El color debe ser un hex válido (ej. #166499)' })
  color?: string | null;
}
