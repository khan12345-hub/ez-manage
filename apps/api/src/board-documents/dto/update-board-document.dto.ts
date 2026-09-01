import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBoardDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;
}
