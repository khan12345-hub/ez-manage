import { IsInt } from "class-validator";

export class DeleteGroupDto {
  @IsInt()
  boardId!: number;
}