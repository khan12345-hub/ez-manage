import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsInt()
  groupId!: number;

  @IsInt()
  @IsOptional()
  parentId?: number;

  @IsString()
  @MinLength(1)
  name!: string;
}
