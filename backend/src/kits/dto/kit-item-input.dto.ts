import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class KitItemInputDto {
  @IsString()
  @IsNotEmpty()
  componentId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
