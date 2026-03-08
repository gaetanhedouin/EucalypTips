import { IsBoolean, IsEmail, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsBoolean()
  isAdultConfirmed!: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'redirectBaseUrl must be a valid URL' })
  redirectBaseUrl?: string;
}
