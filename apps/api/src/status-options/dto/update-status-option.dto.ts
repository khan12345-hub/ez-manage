import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateStatusOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsString()
  color?: string;
}