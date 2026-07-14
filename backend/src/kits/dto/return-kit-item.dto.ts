import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ReturnKitItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
