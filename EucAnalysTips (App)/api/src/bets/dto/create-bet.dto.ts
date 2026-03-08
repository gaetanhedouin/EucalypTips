import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Sport } from '@nouveau/types';

class BetLegDto {
  @IsString()
  sportEventId!: string;

  @IsString()
  market!: string;

  @IsString()
  selection!: string;

  @IsNumber()
  @Min(1.01)
  oddsDecimal!: number;
}

export class CreateBetDto {
  @IsString()
  bankrollId!: string;

  @IsEnum(['FOOTBALL', 'BASKETBALL', 'TENNIS'])
  sport!: Sport;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookmaker?: string;

  @IsNumber()
  @Min(0.01)
  stakeUnits!: number;

  @IsNumber()
  @Min(1.01)
  oddsDecimal!: number;

  @IsBoolean()
  isLive!: boolean;

  @IsDateString()
  eventStartAt!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BetLegDto)
  legs?: BetLegDto[];
}
