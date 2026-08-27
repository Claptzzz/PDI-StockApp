import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTermsDocumentDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  name: string;
}

export class UpdateTermsDocumentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateTermsVersionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La etiqueta de versión es obligatoria' })
  @MaxLength(40)
  version: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(200)
  title: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El contenido es obligatorio' })
  @MaxLength(50_000)
  body: string;

  /** true publica de inmediato; false (o ausente) deja un borrador editable. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  publish?: boolean;
}

export class UpdateTermsVersionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  body?: string;
}

export class SetCourseTermsDto {
  /** null = el curso vuelve a usar el documento por defecto. */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  termsDocumentId: string | null;
}
