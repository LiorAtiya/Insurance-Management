import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Length,
  Matches,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Length(9, 9, { message: 'nationalId must be exactly 9 digits' })
  @Matches(/^\d{9}$/, { message: 'nationalId must contain only digits' })
  nationalId: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
