import { IsInt } from "class-validator";

export class ReorderColumnDto {
  @IsInt()
  boardId!: number;

  @IsInt()
  draggedColumnId!: number;

  @IsInt()
  targetColumnId!: number;
}
