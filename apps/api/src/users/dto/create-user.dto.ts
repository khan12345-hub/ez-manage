import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserStatus } from '@shared/*';


export class CreateUserDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsEnum(UserStatus)
  status!: UserStatus;
}
