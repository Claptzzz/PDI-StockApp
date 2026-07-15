import { IsBoolean } from 'class-validator';

export class UpdateAssistantDto {
  @IsBoolean()
  active: boolean;
}
