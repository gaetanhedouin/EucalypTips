import { IsEnum, IsOptional } from 'class-validator';
import type { Sport, Window } from '@nouveau/types';

export class PublicWidgetQueryDto {
  @IsEnum(['DAY', 'WEEK', 'MONTH', 'QUARTER', 'ALL_TIME', 'CUSTOM'])
  window!: Window;

  @IsOptional()
  @IsEnum(['FOOTBALL', 'BASKETBALL', 'TENNIS'])
  sport?: Sport;
}
