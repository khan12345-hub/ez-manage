import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
