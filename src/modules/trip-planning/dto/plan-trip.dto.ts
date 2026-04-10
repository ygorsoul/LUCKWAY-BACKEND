import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsEnum,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MealPreference {
  RESTAURANT = 'RESTAURANT',
  SELF_COOK = 'SELF_COOK',
  MIXED = 'MIXED',
}

export enum SleepPreference {
  HOTEL = 'HOTEL',
  CAMPING = 'CAMPING',
  MOTORHOME = 'MOTORHOME',
  MIXED = 'MIXED',
}

export class CustomStopDto {
  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNumber()
  @Min(0)
  hoursAfterStart: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(480)
  durationMinutes?: number;
}

export class SleepStopDto {
  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNumber()
  @Min(1)
  dayNumber: number; // Which night (1 = first night, 2 = second night, etc.)

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(720)
  durationMinutes?: number; // Sleep duration (default 480 = 8h)
}

export class PlanTripDto {
  @IsNotEmpty()
  @IsString()
  origin: string;

  @IsNotEmpty()
  @IsString()
  destination: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  waypoints?: string[];

  @IsNotEmpty()
  @IsString()
  vehicleId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  maxDrivingHoursPerDay?: number;

  @IsOptional()
  @IsString()
  departurePreferredTime?: string; // HH:mm format

  @IsOptional()
  @IsString()
  drivingEndLimitTime?: string; // HH:mm format

  @IsOptional()
  @IsBoolean()
  mealBreakEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  breakfastEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  lunchEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  afternoonSnackEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dinnerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  bathroomBreaksEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  stretchBreaksEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(8)
  restBreakIntervalHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  travelersCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelPrice?: number;

  // Per-country fuel prices. When provided, a weighted average is used for cost calculation.
  @IsOptional()
  @IsObject()
  fuelPriceByCountry?: Record<string, number>;

  @IsOptional()
  @IsString()
  departureDate?: string; // ISO date string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomStopDto)
  customStops?: CustomStopDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SleepStopDto)
  sleepStops?: SleepStopDto[];

  // Preferências de refeição
  @IsOptional()
  @IsEnum(MealPreference)
  mealPreference?: MealPreference;

  // Preferências de pernoite
  @IsOptional()
  @IsEnum(SleepPreference)
  sleepPreference?: SleepPreference;

  // Se deve sugerir POIs automaticamente
  @IsOptional()
  @IsBoolean()
  autoSuggestPOIs?: boolean;
}
