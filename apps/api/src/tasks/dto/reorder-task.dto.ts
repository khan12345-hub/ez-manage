import { IsInt, IsOptional } from "class-validator";

export class ReorderTaskDto {
  @IsInt()
  draggedTaskId!: number;

  @IsInt()
  @IsOptional()
  targetTaskId?: number;

  @IsInt()
  destinationGroupId!: number;
}