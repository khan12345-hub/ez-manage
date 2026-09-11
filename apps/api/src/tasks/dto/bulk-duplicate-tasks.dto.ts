import { IsBoolean, IsInt } from 'class-validator';

export class BulkDuplicateTasksDto {
  @IsInt({ each: true })
  taskIds!: number[];

  @IsBoolean()
  withUpdates!: boolean;
}
