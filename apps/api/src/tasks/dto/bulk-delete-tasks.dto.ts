import { IsArray, IsInt } from "class-validator";

export class BulkDeleteTasksDto {
  @IsArray()
  @IsInt({ each: true })
  taskIds!: number[];
}