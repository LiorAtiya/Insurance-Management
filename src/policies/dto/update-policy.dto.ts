import { IsNumber, IsPositive, IsDateString, IsOptional } from 'class-validator';

export class UpdatePolicyDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  premium?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
