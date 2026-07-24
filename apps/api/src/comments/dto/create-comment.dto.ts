import {
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsOptional()
  content!: string;
}