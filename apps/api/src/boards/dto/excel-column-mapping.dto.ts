import { IsEnum, IsString } from "class-validator";

export enum ExcelColumnType {
  TEXT = "TEXT",
  NUMBER = "NUMBER",
  DATE = "DATE",
  STATUS = "STATUS",
  PERSON = "PERSON",
  CHECKBOX = "CHECKBOX",
  DROPDOWN = "DROPDOWN",
  LABEL = "LABEL",
}

export class ExcelColumnMappingDto {
  @IsString()
  sourceColumn!: string;

  @IsString()
  targetColumn!: string;

  @IsEnum(ExcelColumnType)
  type!: ExcelColumnType;
}