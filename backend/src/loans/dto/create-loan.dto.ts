import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLoanDto {
  // Opcional a nivel de DTO: si no viene, el servicio lo deriva del componente.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  componentName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  componentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
