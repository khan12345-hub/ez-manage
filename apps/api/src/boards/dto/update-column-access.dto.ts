import { IsBoolean } from 'class-validator';

export class UpdateColumnAccessDto {
  @IsBoolean()
  enabled!: boolean;
}