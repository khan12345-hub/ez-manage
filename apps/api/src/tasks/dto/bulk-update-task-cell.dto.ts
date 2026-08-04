import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class BulkStatusValueDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  color!: string;
}

export class BulkUpdateTaskCellDto {
  @IsInt({ each: true })
  taskIds!: number[];

  @IsInt()
  columnId!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => BulkStatusValueDto)
  value!: BulkStatusValueDto;
}