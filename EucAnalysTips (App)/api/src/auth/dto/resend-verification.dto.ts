import { IsEmail, IsOptional, IsUrl } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'redirectBaseUrl must be a valid URL' })
  redirectBaseUrl?: string;
}
