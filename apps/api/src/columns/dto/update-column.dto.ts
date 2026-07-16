import { IsNotEmpty, IsString } from "class-validator";

export class UpdateColumnDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}