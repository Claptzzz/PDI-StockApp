import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { HEX_COLOR_REGEX } from './create-tag.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export class UpdateTagDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la etiqueta no puede quedar vacío' })
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'El color debe ser un hex válido (ej. #166499)' })
  color?: string | null;
}
