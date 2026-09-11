import { IsInt } from 'class-validator';

export class BulkMoveTasksDto {
  @IsInt({ each: true })
  taskIds!: number[];

  @IsInt()
  targetGroupId!: number;
}
