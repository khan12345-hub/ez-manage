import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['USER', 'SUPER_ADMIN'])
  systemRole?: 'USER' | 'SUPER_ADMIN';

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
