import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(16)
  refreshToken?: string;
}
