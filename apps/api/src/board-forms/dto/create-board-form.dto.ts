import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBoardFormStatusOptionDto {
  id?: number | string;
  label!: string;
  value!: string;
  color!: string;
}

export class CreateBoardFormFieldDto {
  @IsInt()
  columnId!: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  position?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  statusOptions?: CreateBoardFormStatusOptionDto[];

}

export class CreateBoardFormDto {
  @IsInt()
  groupId!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  submitLabel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBoardFormFieldDto)
  fields!: CreateBoardFormFieldDto[];
}
