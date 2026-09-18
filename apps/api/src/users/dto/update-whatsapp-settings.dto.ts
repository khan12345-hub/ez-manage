import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateWhatsappSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s\-()]*$/, { message: 'Invalid phone number format' })
  whatsappPhone?: string;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOnAssigned?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOnStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOnDate?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOnComment?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOnMention?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOnAutomation?: boolean;
}
