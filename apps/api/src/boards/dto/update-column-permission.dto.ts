import { IsBoolean, IsInt } from 'class-validator';

export class UpdateColumnPermissionDto {
  @IsInt()
  userId!: number;

  @IsBoolean()
  canEdit!: boolean;
}