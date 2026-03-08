import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { Sport, Window } from '@nouveau/types';

export class PublicLeaderboardQueryDto {
  @IsEnum(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'ALL_TIME', 'CUSTOM'])
  window!: Window;

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
