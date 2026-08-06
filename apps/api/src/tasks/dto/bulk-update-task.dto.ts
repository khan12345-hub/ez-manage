console.log("BulkUpdateDto loaded");
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
} from 'class-validator';

export class BulkUpdateDto {
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  taskIds!: number[];

  @Type(() => Number)
  @IsInt()
  columnId!: number;

  @IsNotEmpty()
  value: any;
}