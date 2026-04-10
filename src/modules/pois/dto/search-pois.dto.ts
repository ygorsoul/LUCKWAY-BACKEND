import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPOIsDto {
  @IsNumber()
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @Type(() => Number)
  lng: number;

  @IsNumber()
  @Min(100)
  @Max(50000) // máximo 50km
  @Type(() => Number)
  @IsOptional()
  radiusInMeters?: number = 5000; // padrão 5km
}
