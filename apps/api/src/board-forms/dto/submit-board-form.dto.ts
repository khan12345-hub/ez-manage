import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class BoardFormValueDto {
  @IsInt()
  columnId!: number;

  @IsOptional()
  value?: unknown;
}

export class SubmitBoardFormDto {
  @IsOptional()
  @IsString()
  taskName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardFormValueDto)
  values!: BoardFormValueDto[];
}