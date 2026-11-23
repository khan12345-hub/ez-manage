import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsBoolean,
  MaxLength,
  Min,
  Max,
  IsPositive,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'PKR', 'AED', 'INR'];

export class CreateClaimDto {
  @IsString() @MaxLength(160) title!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(100_000_000) amount!: number;
  @IsOptional() @IsIn(CURRENCIES) currency?: string;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() incurredOn?: string;
  /** when true, the claim is submitted immediately instead of saved as a draft */
  @IsOptional() @IsBoolean() submit?: boolean;
}

export class EditClaimDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(100_000_000) amount?: number;
  @IsOptional() @IsIn(CURRENCIES) currency?: string;
  @IsOptional() @Type(() => Number) @IsInt() categoryId?: number | null;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() incurredOn?: string;
}

export class RejectDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class CategoryDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) monthlyBudget?: number | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
