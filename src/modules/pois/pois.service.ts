import { Injectable, Logger } from '@nestjs/common';
import { OverpassProvider } from './providers/overpass.provider';
import { POI, SearchPOIsParams } from './types/poi.types';

@Injectable()
export class POIsService {
  private readonly logger = new Logger(POIsService.name);

  constructor(private readonly overpassProvider: OverpassProvider) {}

  /**
   * Busca POIs de infraestrutura de apoio em uma localização específica
   * @param params Parâmetros de busca (coordenadas e raio)
   * @returns Lista de POIs encontrados
   */
  async searchPOIs(params: SearchPOIsParams): Promise<POI[]> {
    this.logger.log(
      `Buscando POIs para coordenadas (${params.lat}, ${params.lng}) com raio de ${params.radiusInMeters}m`,
    );

    const pois = await this.overpassProvider.searchPOIs(params);

    this.logger.log(`Total de ${pois.length} POIs encontrados`);

    return pois;
  }

  /**
   * Busca POIs especificamente na região de destino/chegada
   * Útil para planejamento de viagem onde o usuário quer saber a infraestrutura disponível no destino
   * @param destinationLat Latitude do destino
   * @param destinationLng Longitude do destino
   * @param radiusInMeters Raio de busca em metros (padrão: 5000m)
   * @returns Lista de POIs encontrados no destino
   */
  async searchPOIsAtDestination(
    destinationLat: number,
    destinationLng: number,
    radiusInMeters: number = 5000,
  ): Promise<POI[]> {
    this.logger.log(
      `Buscando POIs na região de chegada: (${destinationLat}, ${destinationLng})`,
    );

    return this.searchPOIs({
      lat: destinationLat,
      lng: destinationLng,
      radiusInMeters,
    });
  }
}
