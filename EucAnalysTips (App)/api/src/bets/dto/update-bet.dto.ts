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
import type { BetStatus, Sport } from '@nouveau/types';

class UpdateBetLegDto {
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

export class UpdateBetDto {
  @IsOptional()
  @IsEnum(['FOOTBALL', 'BASKETBALL', 'TENNIS'])
  sport?: Sport;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookmaker?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  stakeUnits?: number;

  @IsOptional()
  @IsNumber()
  @Min(1.01)
  oddsDecimal?: number;

  @IsOptional()
  @IsBoolean()
  isLive?: boolean;

  @IsOptional()
  @IsDateString()
  eventStartAt?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'WIN', 'LOSS'])
  status?: BetStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBetLegDto)
  legs?: UpdateBetLegDto[];
}
