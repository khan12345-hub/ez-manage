import { IsInt, IsOptional } from "class-validator";

export class ReorderTaskDto {
  @IsInt()
  taskId!: number;

  @IsInt()
  destinationGroupId!: number;

  @IsOptional()
   @IsInt()
  destinationParentId?: number | null;

  @IsOptional()
  @IsInt()
  previousTaskId?: number | null;

  @IsOptional()
  @IsInt()
  nextTaskId?: number | null;
}