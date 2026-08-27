import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { DISCREPANCY_ACTIONS, type DiscrepancyAction } from '../discrepancy.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ResolveDiscrepancyDto {
  @IsIn(DISCREPANCY_ACTIONS, {
    message: `action debe ser uno de: ${DISCREPANCY_ACTIONS.join(', ')}`,
  })
  action: DiscrepancyAction;

  /** Unidades afectadas. Se valida contra la cantidad del ítem en el servicio. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  /** Justificación de la decisión: obligatoria, queda en el historial. */
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La nota es obligatoria: explica la decisión' })
  @MaxLength(500)
  note: string;
}
