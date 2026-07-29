import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStatusOptionDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsNotEmpty()
  @IsString()
  color!: string;
}