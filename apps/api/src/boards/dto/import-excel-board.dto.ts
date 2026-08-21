
import { Type } from "class-transformer";
import { ExcelColumnMappingDto } from "./excel-column-mapping.dto";

enum WorkspaceVisibility {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
  IsObject,
} from 'class-validator';

export class ImportExcelBoardDto {
  @IsString()
  boardName!: string;

  @IsEnum(WorkspaceVisibility)
  visibility!: WorkspaceVisibility;

  @IsInt()
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
  @IsObject({ each: true })
  @Type(() => Object)
  rows!: Record<string, unknown>[];
}