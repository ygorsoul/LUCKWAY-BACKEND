import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum VehicleType {
  CAR = 'CAR',
  VAN = 'VAN',
  TRAILER = 'TRAILER',
  MOTORHOME = 'MOTORHOME',
}

export enum FuelType {
  GASOLINE = 'GASOLINE',
  ETHANOL = 'ETHANOL',
  DIESEL = 'DIESEL',
  ELECTRIC = 'ELECTRIC',
  HYBRID = 'HYBRID',
}

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

  @IsNotEmpty()
  @IsNumber()
  @Min(0.1)
  averageConsumption: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  tankCapacity: number;
}
