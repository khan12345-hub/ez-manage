import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateStatusOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /** Status group: NOT_STARTED | ACTIVE | DONE. Omitted on create = guessed from the label. */
  @IsOptional()
  @IsIn(['NOT_STARTED', 'ACTIVE', 'DONE'])
  category?: 'NOT_STARTED' | 'ACTIVE' | 'DONE';
}
