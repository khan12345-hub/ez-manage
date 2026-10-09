import { IsArray, IsInt } from 'class-validator';

export class BulkMoveTasksDto {
  @IsArray()
  @IsInt({ each: true })
  taskIds!: number[];

  @IsInt()
  targetGroupId!: number;
}
