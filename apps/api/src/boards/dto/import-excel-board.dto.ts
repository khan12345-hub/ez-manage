import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BoardColumnType } from '@repo/shared';
import { WorkspaceVisibility } from 'generated/prisma/enums';

export class ExcelColumnMappingDto {
  @IsString()
  sourceColumn!: string;

  @IsString()
  targetColumn!: string;

  @IsEnum(BoardColumnType)
  type: BoardColumnType;
}

export class ImportExcelBoardDto {
  @IsString()
  boardName!: string;

  @IsEnum(WorkspaceVisibility)
  visibility!: WorkspaceVisibility;

  @IsString()
  workspaceId!: number;

  @IsString()
  taskColumn!: string;

  @IsOptional()
  @IsString()
  groupColumn?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelColumnMappingDto)
  columns!: ExcelColumnMappingDto[];

  @IsArray()
  rows!: Record<string, unknown>[];
}
