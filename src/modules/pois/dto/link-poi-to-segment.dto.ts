import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsObject } from 'class-validator';

export class LinkPOIToSegmentDto {
  @IsString()
  @IsNotEmpty()
  tripId: string;

  @IsString()
  @IsOptional()
  segmentId?: string; // Se não fornecido, cria novo segment

  @IsString()
  @IsNotEmpty()
  poiId: string;

  @IsObject()
  @IsNotEmpty()
  poiData: object; // POI completo em JSON

  @IsBoolean()
  @IsOptional()
  isDayEndpoint?: boolean;

  @IsNumber()
  @IsOptional()
  stopDuration?: number; // minutos

  @IsString()
  @IsOptional()
  stopNote?: string;

  @IsString()
  @IsOptional()
  segmentType?: 'SLEEP' | 'REST' | 'MEAL' | 'FUEL' | 'SHOWER' | 'LAUNDRY'; // Tipo do segment se criar novo
}
