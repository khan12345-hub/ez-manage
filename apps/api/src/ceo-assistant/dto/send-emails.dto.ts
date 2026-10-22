import { IsArray, IsInt, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class EmailDraftItemDto {
  @IsInt()
  recipientId: number;

  @IsString()
  subject: string;

  @IsString()
  body: string;
}

export class SendEmailsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => EmailDraftItemDto)
  drafts: EmailDraftItemDto[];
}
