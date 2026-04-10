import { IsString, IsNumber, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookmarkDto {
  @IsString()
  poiId: string; // ID do OSM

  @IsString()
  poiName: string;

  @IsString()
  poiType: string; // Pernoite, Banho, etc

  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @IsString()
  poiData: string; // JSON do POI completo

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;
}
