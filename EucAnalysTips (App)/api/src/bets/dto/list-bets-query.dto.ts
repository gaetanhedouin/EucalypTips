import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { BetStatus, Sport } from '@nouveau/types';

export class ListBetsQueryDto {
  @IsOptional()
  @IsString()
  bankrollId?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'WIN', 'LOSS'])
  status?: BetStatus;

  @IsOptional()
  @IsEnum(['FOOTBALL', 'BASKETBALL', 'TENNIS'])
  sport?: Sport;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
