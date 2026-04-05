import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
}
