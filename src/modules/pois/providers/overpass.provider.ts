import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import {
  POI,
  POIServiceType,
  SearchPOIsParams,
  POITags,
} from '../types/poi.types';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  center?: {
    lat: number;
    lon: number;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

@Injectable()
export class OverpassProvider {
  private readonly logger = new Logger(OverpassProvider.name);
  private readonly baseUrl = 'https://overpass-api.de/api/interpreter';
  private readonly timeout = 30000; // 30 segundos

  /**
   * Busca POIs usando a Overpass API do OpenStreetMap
   * @param params Parâmetros de busca (lat, lng, radius)
   * @returns Lista de POIs encontrados
   */
  async searchPOIs(params: SearchPOIsParams): Promise<POI[]> {
    const { lat, lng, radiusInMeters } = params;

    this.logger.log(
      `Buscando POIs em raio de ${radiusInMeters}m ao redor de (${lat}, ${lng})`,
    );

    const query = this.buildOverpassQuery(lat, lng, radiusInMeters);

    try {
      const response = await axios.post<OverpassResponse>(
        this.baseUrl,
        query,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: this.timeout,
        },
      );

      const pois = this.formatResults(response.data, lat, lng);
      this.logger.log(`Encontrados ${pois.length} POIs`);

      return pois;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Constrói a query Overpass otimizada para buscar todos os critérios simultaneamente
   */
  private buildOverpassQuery(
    lat: number,
    lng: number,
    radius: number,
  ): string {
    // Query otimizada que busca todos os tipos de POI em uma única requisição
    return `
      [out:json][timeout:25];
      (
        // Locais para dormir
        node["tourism"="camp_site"](around:${radius},${lat},${lng});
        way["tourism"="camp_site"](around:${radius},${lat},${lng});
        node["tourism"="caravan_site"](around:${radius},${lat},${lng});
        way["tourism"="caravan_site"](around:${radius},${lat},${lng});
        node["amenity"="parking"]["access"="yes"](around:${radius},${lat},${lng});
        way["amenity"="parking"]["access"="yes"](around:${radius},${lat},${lng});

        // Locais para banho
        node["amenity"="shower"](around:${radius},${lat},${lng});
        way["amenity"="shower"](around:${radius},${lat},${lng});
        node["amenity"="fuel"]["shower"="yes"](around:${radius},${lat},${lng});
        way["amenity"="fuel"]["shower"="yes"](around:${radius},${lat},${lng});

        // Locais para lavar roupa
        node["shop"="laundry"](around:${radius},${lat},${lng});
        way["shop"="laundry"](around:${radius},${lat},${lng});
        node["amenity"="washing_machine"](around:${radius},${lat},${lng});
        way["amenity"="washing_machine"](around:${radius},${lat},${lng});

        // Água potável
        node["amenity"="drinking_water"](around:${radius},${lat},${lng});
        way["amenity"="drinking_water"](around:${radius},${lat},${lng});
      );
      out center tags;
    `.trim();
  }

  /**
   * Formata os resultados da Overpass API para o formato padronizado
   */
  private formatResults(
    data: OverpassResponse,
    refLat: number,
    refLng: number,
  ): POI[] {
    const pois: POI[] = [];

    for (const element of data.elements) {
      const poi = this.elementToPOI(element, refLat, refLng);
      if (poi) {
        pois.push(poi);
      }
    }

    // Ordena por distância (mais próximo primeiro)
    return pois.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  /**
   * Converte um elemento Overpass em POI
   */
  private elementToPOI(
    element: OverpassElement,
    refLat: number,
    refLng: number,
  ): POI | null {
    if (!element.tags) return null;

    // Determina as coordenadas (node tem lat/lon direto, way tem center)
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;

    if (!lat || !lon) return null;

    const serviceType = this.determineServiceType(element.tags);
    if (!serviceType) return null;

    const name = this.determineName(element.tags, serviceType);
    const distance = this.calculateDistance(refLat, refLng, lat, lon);

    return {
      id: element.id,
      name,
      serviceType,
      coordinates: { lat, lng: lon },
      tags: this.extractRelevantTags(element.tags),
      distance,
    };
  }

  /**
   * Determina o tipo de serviço com base nas tags
   */
  private determineServiceType(
    tags: Record<string, string>,
  ): POIServiceType | null {
    // Dormir
    if (
      tags.tourism === 'camp_site' ||
      tags.tourism === 'caravan_site' ||
      (tags.amenity === 'parking' && tags.access === 'yes')
    ) {
      return POIServiceType.SLEEP;
    }

    // Banho
    if (tags.amenity === 'shower' || tags.shower === 'yes') {
      return POIServiceType.SHOWER;
    }

    // Lavar roupa
    if (tags.shop === 'laundry' || tags.amenity === 'washing_machine') {
      return POIServiceType.LAUNDRY;
    }

    // Água potável
    if (tags.amenity === 'drinking_water') {
      return POIServiceType.WATER;
    }

    return null;
  }

  /**
   * Determina o nome do POI
   */
  private determineName(
    tags: Record<string, string>,
    serviceType: POIServiceType,
  ): string {
    if (tags.name) return tags.name;

    // Nomes padrão baseados no tipo
    const defaultNames: Record<POIServiceType, string> = {
      [POIServiceType.SLEEP]: tags.tourism === 'camp_site'
        ? 'Camping'
        : tags.tourism === 'caravan_site'
          ? 'Área para Trailers'
          : 'Estacionamento',
      [POIServiceType.SHOWER]: 'Chuveiro Público',
      [POIServiceType.LAUNDRY]: 'Lavanderia',
      [POIServiceType.WATER]: 'Água Potável',
    };

    return defaultNames[serviceType];
  }

  /**
   * Extrai tags relevantes para exibição
   */
  private extractRelevantTags(tags: Record<string, string>): POITags {
    const relevantKeys = [
      'name',
      'phone',
      'website',
      'opening_hours',
      'fee',
      'shower',
      'access',
      'capacity',
      'operator',
      'description',
    ];

    const extracted: POITags = {};

    for (const key of relevantKeys) {
      if (tags[key]) {
        extracted[key] = tags[key];
      }
    }

    return extracted;
  }

  /**
   * Calcula a distância entre dois pontos usando a fórmula Haversine
   * @returns Distância em metros
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // Distância em metros
  }

  /**
   * Tratamento de erros da Overpass API
   */
  private handleError(error: AxiosError): never {
    if (error.response?.status === 429) {
      this.logger.error('Rate limit atingido na Overpass API');
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Limite de requisições atingido. Tente novamente em alguns minutos.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      this.logger.error('Timeout na requisição para Overpass API');
      throw new HttpException(
        {
          statusCode: HttpStatus.GATEWAY_TIMEOUT,
          message: 'Tempo limite excedido ao buscar POIs. Tente novamente.',
          error: 'Gateway Timeout',
        },
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }

    this.logger.error(
      `Erro na Overpass API: ${error.message}`,
      error.stack,
    );
    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Serviço de busca de POIs temporariamente indisponível.',
        error: 'Service Unavailable',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
