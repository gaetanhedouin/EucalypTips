import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import type { BankrollMode } from '@nouveau/types';

export class UpdateBankrollDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(['SECURE_LOCKED', 'FLEX_EDIT'])
  mode?: BankrollMode;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
