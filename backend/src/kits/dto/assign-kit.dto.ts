import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { KitItemInputDto } from './kit-item-input.dto';

export class AssignKitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  templateId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => KitItemInputDto)
  items?: KitItemInputDto[];
}
