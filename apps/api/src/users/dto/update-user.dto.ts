import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Z]/, {
    message: 'New password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'New password must contain at least one number',
  })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'New password must contain at least one special character',
  })
  newPassword?: string;
}