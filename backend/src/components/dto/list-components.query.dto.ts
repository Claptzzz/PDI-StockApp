import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * Normaliza `?tagId=a` y `?tagIds=a,b` (y repeticiones del mismo query param)
 * a un array de ids sin duplicados ni vacíos.
 */
const toIdArray = ({ value }: { value: unknown }): string[] | undefined => {
  const raw = Array.isArray(value) ? value : [value];
  const ids = raw
    .filter((v): v is string => typeof v === 'string')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : undefined;
};

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ListComponentsQueryDto {
  /** Busca por nombre O código (contains, case-insensitive). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  /** Filtro por una etiqueta. */
  @IsOptional()
  @Transform(toIdArray)
  @IsArray()
  @IsString({ each: true })
  tagId?: string[];

  /** Filtro por varias etiquetas (separadas por coma). */
  @IsOptional()
  @Transform(toIdArray)
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}
