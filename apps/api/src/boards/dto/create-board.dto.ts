import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { BoardVisibility } from '../../../generated/prisma/client';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsNotEmpty()
  workspaceId!: number;

  @IsOptional()
  @IsEnum(BoardVisibility)
  visibility?: BoardVisibility;
}
