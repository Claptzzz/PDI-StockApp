import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** String vacío o solo espacios → null (nota opcional). */
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export class VerifyKitItemDto {
  @IsString()
  @IsNotEmpty()
  kitItemId: string;

  /** "Recibido conforme". false = el alumno reporta que no lo recibió / no está OK. */
  @IsBoolean()
  verified: boolean;

  /** Discrepancia libre ("llegó dañado", "faltan 2"). Se registra, no ajusta nada. */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class VerifyKitDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Debes enviar los ítems del kit' })
  @ValidateNested({ each: true })
  @Type(() => VerifyKitItemDto)
  items: VerifyKitItemDto[];
}
