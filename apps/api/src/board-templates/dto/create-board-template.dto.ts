import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

import { BoardColumnType } from "generated/prisma/enums";

export class CreateBoardTemplateColumnDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(BoardColumnType)
  type!: BoardColumnType;

  @IsInt()
  @Min(0)
  position!: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsObject()
  @IsOptional()
  options?: Record<string, unknown>;
}

export class CreateBoardTemplateGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  color!: string;

  @IsInt()
  @Min(0)
  position!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBoardTemplateColumnDto)
  columns!: CreateBoardTemplateColumnDto[];
}

export class CreateBoardTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBoardTemplateGroupDto)
  groups!: CreateBoardTemplateGroupDto[];
}