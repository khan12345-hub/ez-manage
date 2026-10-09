import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional, IsInt, IsPositive } from 'class-validator';
import { BoardVisibility } from '../../../generated/prisma/client';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @IsPositive()
  workspaceId!: number;

  @IsOptional()
  @IsEnum(BoardVisibility)
  visibility?: BoardVisibility;

  @IsOptional()
  @IsInt()
  templateId?: number;
}
