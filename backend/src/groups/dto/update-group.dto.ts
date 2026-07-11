import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
