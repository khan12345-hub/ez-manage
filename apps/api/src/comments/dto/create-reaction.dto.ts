import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  emoji: string;
}
