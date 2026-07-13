import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
