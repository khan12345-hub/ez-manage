import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

const nullable = ({ value }: { value: unknown }) => (value === '' || value === 'null' ? null : value);

export class UpdateUserSettingsDto {
  // profile (Executive Hub → My profile); '' clears a field
  @IsOptional() @Transform(nullable) @ValidateIf((_, v) => v !== null) @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'Phone: digits only, e.g. +92 300 1234567' }) @MaxLength(20)
  phone?: string | null;

  @IsOptional() @Transform(nullable) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(80)
  jobTitle?: string | null;

  @IsOptional() @Transform(nullable) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(64)
  timezone?: string | null;

  @IsOptional() @Transform(nullable) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500)
  bio?: string | null;

  @IsOptional() @Transform(nullable) @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000)
  emailSignature?: string | null;

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