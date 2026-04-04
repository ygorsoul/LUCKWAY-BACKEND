import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class PlanTripDto {
  @IsNotEmpty()
  @IsString()
  origin: string;

  @IsNotEmpty()
  @IsString()
  destination: string;

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
  @IsNumber()
  @Min(1)
  travelersCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelPrice?: number;

  @IsOptional()
  @IsString()
  departureDate?: string; // ISO date string
}
