import { IsInt, IsOptional } from "class-validator";

export class ReorderGroupDto {
  @IsInt()
  boardId!: number;

  @IsInt()
  groupId!: number;

  @IsOptional()
  @IsInt()
  previousGroupId!: number | null;

  @IsOptional()
  @IsInt()
  nextGroupId!: number | null;
}
