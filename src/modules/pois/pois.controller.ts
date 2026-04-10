import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { POIsService } from './pois.service';
import { SearchPOIsDto } from './dto/search-pois.dto';
import { POI } from './types/poi.types';

@Controller('pois')
@UseGuards(JwtAuthGuard)
export class POIsController {
  constructor(private readonly poisService: POIsService) {}

  /**
   * Busca POIs de infraestrutura de apoio para viajantes
   * @param dto Parâmetros de busca (lat, lng, raio)
   * @returns Lista de POIs encontrados
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async searchPOIs(@Body() dto: SearchPOIsDto): Promise<POI[]> {
    return this.poisService.searchPOIs({
      lat: dto.lat,
      lng: dto.lng,
      radiusInMeters: dto.radiusInMeters || 5000,
    });
  }

  /**
   * Busca POIs especificamente na região de destino/chegada
   * Endpoint específico para buscar infraestrutura no local de chegada da viagem
   * @param dto Parâmetros de busca (lat, lng do destino, raio)
   * @returns Lista de POIs encontrados no destino
   */
  @Post('search-at-destination')
  @HttpCode(HttpStatus.OK)
  async searchPOIsAtDestination(@Body() dto: SearchPOIsDto): Promise<POI[]> {
    return this.poisService.searchPOIsAtDestination(
      dto.lat,
      dto.lng,
      dto.radiusInMeters || 5000,
    );
  }
}
