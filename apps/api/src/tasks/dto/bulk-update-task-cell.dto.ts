import { IsArray, ArrayNotEmpty, IsInt, IsObject } from "class-validator";
import { Type } from "class-transformer";

export class BulkUpdateStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  taskIds!: number[];

  @Type(() => Number)
  @IsInt()
  columnId!: number;

  @IsObject()
  value!: {
    label: string;
    color: string;
  };
}