import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PolicyType } from '../../common/enums/policy-type.enum';
import { PolicyStatus } from '../../common/enums/policy-status.enum';

export class QueryPoliciesDto {
  @IsOptional()
  @IsEnum(PolicyType)
  type?: PolicyType;

  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;

  @IsOptional()
  @IsString()
  customerId?: string;
}
