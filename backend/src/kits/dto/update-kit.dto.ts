import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateKitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code: string;
}
