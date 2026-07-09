import { IsString, Matches } from 'class-validator';

export class SetupAccountDto {
  @IsString()
  token!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @Matches(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]).{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character.',
    },
  )
  password!: string;
}
