import { IsEnum, IsString } from "class-validator";

export enum ExcelColumnType {
  TEXT = "TEXT",
  LONG_TEXT = "LONG_TEXT",
  NUMBER = "NUMBER",
  PRICE = "PRICE",
  DATE = "DATE",
  STATUS = "STATUS",
  PERSON = "PERSON",
  CHECKBOX = "CHECKBOX",
  DROPDOWN = "DROPDOWN",
  LABEL = "LABEL",
  FILE = "FILE",
  LINK = "LINK",
  COMMENT = "COMMENT",
  FILE_FEEDBACK = "FILE_FEEDBACK",
  CREATION_LOG = "CREATION_LOG",
  EMAIL = "EMAIL",
  TIME_TRACKING = "TIME_TRACKING",
  SKIP = "SKIP",
}

export class ExcelColumnMappingDto {
  @IsString()
  sourceColumn!: string;

  @IsString()
  targetColumn!: string;

  @IsEnum(ExcelColumnType)
  type!: ExcelColumnType;
}