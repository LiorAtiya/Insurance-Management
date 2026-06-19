import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
} from 'class-validator';
import { PolicyType } from '../../common/enums/policy-type.enum';

export class IssuePolicyDto {
  @IsEnum(PolicyType)
  type: PolicyType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  premium: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
