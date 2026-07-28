import { IsInt, IsOptional, Min } from 'class-validator';

export class ReorderSubtaskDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  previousTaskId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  nextTaskId?: number | null;
}