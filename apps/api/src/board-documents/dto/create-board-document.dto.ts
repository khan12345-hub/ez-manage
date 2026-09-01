import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';

export class CreateBoardDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsObject()
  content: Record<string, any>;
}
