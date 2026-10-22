import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BoardVisibility } from '../../../generated/prisma/client';

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Board name must be at least 1 character' })
  @MaxLength(100, { message: 'Board name must not exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsEnum(BoardVisibility)
  visibility?: BoardVisibility;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  budgetHours?: number | null;
}
