import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class SaveTemplateDto {
  @IsString()
  name: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  @IsIn(['professional', 'friendly', 'firm'])
  tone?: string = 'professional';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}
