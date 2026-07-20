import { IsInt, IsOptional } from "class-validator";

export class ReorderColumnDto {
  @IsInt()
  boardId!: number;

  @IsInt()
  columnId!: number;

  @IsOptional()
  @IsInt()
  previousColumnId?: number | null;

  @IsOptional()
  @IsInt()
  nextColumnId?: number | null;
}
