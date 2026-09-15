import { IsInt } from 'class-validator';

export class CreateCellDto {
  @IsInt()
  taskId: number;

  @IsInt()
  columnId: number;
}

