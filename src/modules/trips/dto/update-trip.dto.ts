import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TripStatus } from './create-trip.dto';

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
