import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Trim; cadena vacía → null (nota opcional de la devolución). */
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export class ReturnLoanDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  /** Observación de quien recibe: estado del componente, daños, etc. */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
