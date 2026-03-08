import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import type { BankrollMode } from '@nouveau/types';

export class CreateBankrollDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(['SECURE_LOCKED', 'FLEX_EDIT'])
  mode!: BankrollMode;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
