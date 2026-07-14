import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ReturnLoanDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
