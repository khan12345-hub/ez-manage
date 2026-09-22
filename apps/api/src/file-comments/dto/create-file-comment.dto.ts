import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFileCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsNumber()
  @IsOptional()
  assignedToId?: number;
}
