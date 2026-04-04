import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

export enum TripStatus {
  DRAFT = 'DRAFT',
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateTripDto {
  @IsNotEmpty()
  @IsString()
  name: string;

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
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  maxDrivingHoursPerDay?: number;

  @IsOptional()
  @IsString()
  departurePreferredTime?: string;

  @IsOptional()
  @IsString()
  drivingEndLimitTime?: string;

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
  startDate?: string;
}
