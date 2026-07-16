import { IsInt, IsString, MinLength } from "class-validator";

export class CreateTaskDto {
  @IsInt()
  groupId!: number;

  @IsString()
  @MinLength(1)
  name!: string;
}