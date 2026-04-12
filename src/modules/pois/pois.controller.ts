import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { POIsService } from './pois.service';
import { SearchPOIsDto, GeocodeDto, LinkPOIToSegmentDto } from './dto';
import { POI } from './types/poi.types';
import { GeocodingProvider } from './providers/geocoding.provider';
import { RoutePOIIntegrationService } from './route-poi-integration.service';

@Controller('pois')
@UseGuards(JwtAuthGuard)
export class POIsController {
  constructor(
    private readonly poisService: POIsService,
    private readonly geocodingProvider: GeocodingProvider,
    private readonly routePOIIntegrationService: RoutePOIIntegrationService,
  ) {}

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

  /**
   * Geocodifica um endereço (cidade, estado, etc) em coordenadas lat/lng
   * @param dto Endereço a ser geocodificado
   * @returns Coordenadas e endereço formatado
   */
  @Post('geocode')
  @HttpCode(HttpStatus.OK)
  async geocode(@Body() dto: GeocodeDto) {
    return this.geocodingProvider.geocode(dto.address);
  }

  /**
   * Vincula um POI a um segmento de viagem (ou cria novo segmento)
   * @param dto Dados do POI e viagem
   * @param userId ID do usuário autenticado
   * @returns Segmento atualizado ou criado
   */
  @Post('link-to-trip')
  @HttpCode(HttpStatus.OK)
  async linkPOIToTrip(@Body() dto: LinkPOIToSegmentDto, @GetUser('id') userId: string) {
    return this.routePOIIntegrationService.linkPOIToTrip(dto, userId);
  }

  /**
   * Desvincula um POI de um segmento de viagem
   * @param segmentId ID do segmento
   * @param userId ID do usuário autenticado
   * @returns Mensagem de sucesso
   */
  @Delete('unlink-from-trip/:segmentId')
  @HttpCode(HttpStatus.OK)
  async unlinkPOIFromTrip(@Param('segmentId') segmentId: string, @GetUser('id') userId: string) {
    return this.routePOIIntegrationService.unlinkPOIFromTrip(segmentId, userId);
  }
}
