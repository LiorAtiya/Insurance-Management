import { IsOptional, IsString, IsBooleanString } from 'class-validator';

export class QueryCustomersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
