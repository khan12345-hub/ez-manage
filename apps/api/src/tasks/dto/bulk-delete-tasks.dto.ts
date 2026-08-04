import { IsInt } from "class-validator";

export class BulkDeleteTasksDto {
  @IsInt({ each: true })
  taskIds!: number[];
}