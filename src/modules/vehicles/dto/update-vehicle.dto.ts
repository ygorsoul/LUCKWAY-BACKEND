import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { VehicleType, FuelType } from './create-vehicle.dto';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  year?: number;

  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  averageConsumption?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  tankCapacity?: number;
}
