import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { VehicleType, FuelType } from '@prisma/client';

export { VehicleType, FuelType };

export class CreateVehicleDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(VehicleType)
  type: VehicleType;

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

  @IsNotEmpty()
  @IsEnum(FuelType)
  fuelType: FuelType;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  averageConsumption?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  tankCapacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  ethanolConsumption?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  electricConsumption?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  batteryCapacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  gnvConsumption?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  gnvTankCapacity?: number;
}
