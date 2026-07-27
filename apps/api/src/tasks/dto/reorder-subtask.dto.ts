import { IsInt, IsOptional, Min } from 'class-validator';

export class ReorderSubtaskDto {
  @IsInt()
  @Min(1)
  subtaskId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  previousSubtaskId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  nextSubtaskId?: number | null;
}