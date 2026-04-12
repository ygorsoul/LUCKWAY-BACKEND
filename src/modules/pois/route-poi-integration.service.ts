import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { POIsService } from './pois.service';
import { POI, POIServiceType } from './types/poi.types';
import { DatabaseService } from '@/database/database.service';
import { LinkPOIToSegmentDto, POISuggestionResponseDto } from './dto';

export interface RoutePoint {
  lat: number;
  lng: number;
  cityName?: string;
  distanceFromStart: number; // em km
}

export interface DayEndPoint extends RoutePoint {
  dayNumber: number;
  isDayEnd: true;
}

export interface IntermediateStop extends RoutePoint {
  stopType: 'MEAL' | 'REST' | 'SHOWER' | 'LAUNDRY';
  suggestedDuration: number; // minutos
}

export interface POISuggestion {
  point: RoutePoint | DayEndPoint | IntermediateStop;
  pois: POI[];
  category: 'sleep' | 'meal' | 'shower' | 'laundry' | 'water';
  priority: number; // 1-5, sendo 5 mais importante
}

@Injectable()
export class RoutePOIIntegrationService {
  private readonly logger = new Logger(RoutePOIIntegrationService.name);

  constructor(
    private readonly poisService: POIsService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Identifica pontos estratégicos ao longo da rota
   * @param routePoints Array de pontos da rota
   * @param totalDistance Distância total em km
   * @param maxDrivingHoursPerDay Máximo de horas dirigindo por dia
   * @returns Pontos estratégicos onde buscar POIs
   */
  identifyStrategicPoints(
    routePoints: RoutePoint[],
    totalDistance: number,
    maxDrivingHoursPerDay: number = 8,
  ): {
    dayEndPoints: DayEndPoint[];
    intermediateStops: IntermediateStop[];
  } {
    const avgSpeed = 80; // km/h (velocidade média em estrada)
    const dailyDistanceKm = maxDrivingHoursPerDay * avgSpeed;

    const dayEndPoints: DayEndPoint[] = [];
    const intermediateStops: IntermediateStop[] = [];

    // Calcular pontos de final de dia (a cada X km baseado em horas de direção)
    const numberOfDays = Math.ceil(totalDistance / dailyDistanceKm);

    for (let day = 1; day < numberOfDays; day++) {
      const targetDistance = day * dailyDistanceKm;
      const point = this.findClosestPoint(routePoints, targetDistance);

      if (point) {
        dayEndPoints.push({
          ...point,
          dayNumber: day,
          isDayEnd: true,
        });
      }
    }

    // Pontos intermediários para refeições (a cada ~200km ou 2.5h)
    const mealIntervalKm = 200;
    const numberOfMealStops = Math.floor(totalDistance / mealIntervalKm);

    for (let i = 1; i <= numberOfMealStops; i++) {
      const targetDistance = i * mealIntervalKm;
      const point = this.findClosestPoint(routePoints, targetDistance);

      // Evitar sugerir refeição muito perto do ponto de pernoite
      const isTooCloseToSleep = dayEndPoints.some(
        (dep) => Math.abs(dep.distanceFromStart - targetDistance) < 50,
      );

      if (point && !isTooCloseToSleep) {
        intermediateStops.push({
          ...point,
          stopType: 'MEAL',
          suggestedDuration: 60, // 1h
        });
      }
    }

    // Pontos para banho (normalmente próximo ao final do dia)
    dayEndPoints.forEach((dep) => {
      // Sugerir parada para banho ~30-50km antes do ponto de pernoite
      const showerDistance = dep.distanceFromStart - 40;
      const point = this.findClosestPoint(routePoints, showerDistance);

      if (point) {
        intermediateStops.push({
          ...point,
          stopType: 'SHOWER',
          suggestedDuration: 30,
        });
      }
    });

    return { dayEndPoints, intermediateStops };
  }

  /**
   * Busca POIs em todos os pontos estratégicos
   */
  async findPOIsForRoute(
    dayEndPoints: DayEndPoint[],
    intermediateStops: IntermediateStop[],
    mealPreference: string,
    sleepPreference: string,
  ): Promise<POISuggestion[]> {
    const suggestions: POISuggestion[] = [];

    // POIs para pontos de pernoite (alta prioridade)
    for (const point of dayEndPoints) {
      const pois = await this.poisService.searchPOIs({
        lat: point.lat,
        lng: point.lng,
        radiusInMeters: 15000, // 15km de raio para pernoite
      });

      // Filtrar POIs baseado na preferência de pernoite
      const sleepPOIs = this.filterSleepPOIs(pois, sleepPreference);

      if (sleepPOIs.length > 0) {
        suggestions.push({
          point,
          pois: sleepPOIs,
          category: 'sleep',
          priority: 5, // Máxima prioridade
        });
      }
    }

    // POIs para paradas intermediárias
    for (const stop of intermediateStops) {
      const pois = await this.poisService.searchPOIs({
        lat: stop.lat,
        lng: stop.lng,
        radiusInMeters: 5000, // 5km para paradas intermediárias
      });

      if (stop.stopType === 'MEAL') {
        // Se preferência é cozinhar, não sugerir restaurantes
        if (mealPreference === 'SELF_COOK') {
          continue;
        }

        // Aqui poderíamos integrar com API de restaurantes
        // Por enquanto, vamos apenas marcar como sugestão de refeição
        suggestions.push({
          point: stop,
          pois: [], // Futuramente buscar restaurantes
          category: 'meal',
          priority: 3,
        });
      } else if (stop.stopType === 'SHOWER') {
        const showerPOIs = pois.filter(
          (p) => p.serviceType === POIServiceType.SHOWER,
        );

        if (showerPOIs.length > 0) {
          suggestions.push({
            point: stop,
            pois: showerPOIs,
            category: 'shower',
            priority: 4,
          });
        }
      }
    }

    // Água potável em pontos estratégicos (baixa prioridade, mas útil)
    const waterPoints = [...dayEndPoints, ...intermediateStops.filter(s => s.stopType === 'MEAL')];
    for (const point of waterPoints.slice(0, 3)) {
      const pois = await this.poisService.searchPOIs({
        lat: point.lat,
        lng: point.lng,
        radiusInMeters: 3000,
      });

      const waterPOIs = pois.filter(
        (p) => p.serviceType === POIServiceType.WATER,
      );

      if (waterPOIs.length > 0) {
        suggestions.push({
          point,
          pois: waterPOIs,
          category: 'water',
          priority: 2,
        });
      }
    }

    // Ordenar sugestões por prioridade
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Filtra POIs de pernoite baseado na preferência do usuário
   */
  private filterSleepPOIs(pois: POI[], sleepPreference: string): POI[] {
    const sleepPOIs = pois.filter(
      (p) => p.serviceType === POIServiceType.SLEEP,
    );

    if (sleepPreference === 'MIXED') {
      return sleepPOIs;
    }

    // Filtrar por tipo específico
    return sleepPOIs.filter((poi) => {
      const tags = poi.tags;

      if (sleepPreference === 'CAMPING') {
        return tags.tourism === 'camp_site' || tags.tourism === 'caravan_site';
      }

      if (sleepPreference === 'MOTORHOME') {
        return (
          tags.amenity === 'parking' ||
          tags.tourism === 'caravan_site' ||
          tags.amenity === 'fuel'
        );
      }

      // HOTEL: não temos dados de hotéis no OSM geralmente
      // Retornar campings como fallback
      return true;
    });
  }

  /**
   * Encontra o ponto da rota mais próximo de uma distância alvo
   */
  private findClosestPoint(
    points: RoutePoint[],
    targetDistance: number,
  ): RoutePoint | null {
    if (points.length === 0) return null;

    let closest = points[0];
    let minDiff = Math.abs(points[0].distanceFromStart - targetDistance);

    for (const point of points) {
      const diff = Math.abs(point.distanceFromStart - targetDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest;
  }

  /**
   * Converte POI sugerido em dados para vincular ao TripSegment
   */
  async convertPOIToSegmentData(poi: POI) {
    return {
      linkedPoiId: poi.id.toString(),
      poiData: JSON.stringify({
        id: poi.id,
        name: poi.name,
        serviceType: poi.serviceType,
        coordinates: poi.coordinates,
        tags: poi.tags,
        distance: poi.distance,
      }),
    };
  }

  /**
   * Vincula um POI a um segmento de viagem (ou cria novo segmento)
   * @param dto Dados do POI e viagem
   * @param userId ID do usuário autenticado
   * @returns Segmento atualizado ou criado
   */
  async linkPOIToTrip(dto: LinkPOIToSegmentDto, userId: string) {
    this.logger.log(`Vinculando POI ${dto.poiId} à viagem ${dto.tripId} - usuário ${userId}`);

    // Verificar se a viagem existe e pertence ao usuário
    const trip = await this.db.trip.findUnique({
      where: { id: dto.tripId },
      include: { segments: true },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para modificar esta viagem');
    }

    const poiData = JSON.stringify(dto.poiData);

    // Se segmentId foi fornecido, atualiza o segmento existente
    if (dto.segmentId) {
      const segment = await this.db.tripSegment.findUnique({
        where: { id: dto.segmentId },
      });

      if (!segment || segment.tripId !== dto.tripId) {
        throw new NotFoundException('Segmento não encontrado nesta viagem');
      }

      return this.db.tripSegment.update({
        where: { id: dto.segmentId },
        data: {
          linkedPoiId: dto.poiId,
          poiData,
          isDayEndpoint: dto.isDayEndpoint ?? segment.isDayEndpoint,
          stopDuration: dto.stopDuration ?? segment.stopDuration,
          stopNote: dto.stopNote ?? segment.stopNote,
        },
      });
    }

    // Senão, cria um novo segmento
    const segmentType = dto.segmentType || this.inferSegmentTypeFromPOI(dto.poiData);
    const lastSegment = trip.segments.sort((a, b) => b.order - a.order)[0];
    const nextOrder = lastSegment ? lastSegment.order + 1 : 1;

    // Extrair coordenadas do POI
    const poiCoordinates = (dto.poiData as any).coordinates;
    if (!poiCoordinates?.lat || !poiCoordinates?.lng) {
      throw new BadRequestException('POI inválido: coordenadas ausentes');
    }

    const location = `${poiCoordinates.lat},${poiCoordinates.lng}`;

    return this.db.tripSegment.create({
      data: {
        tripId: dto.tripId,
        order: nextOrder,
        type: segmentType,
        startLocation: location,
        endLocation: location,
        linkedPoiId: dto.poiId,
        poiData,
        isDayEndpoint: dto.isDayEndpoint ?? (segmentType === 'SLEEP'),
        stopDuration: dto.stopDuration ?? this.getDefaultStopDuration(segmentType),
        stopNote: dto.stopNote,
      },
    });
  }

  /**
   * Desvincula um POI de um segmento de viagem
   * @param segmentId ID do segmento
   * @param userId ID do usuário autenticado
   * @returns Mensagem de sucesso
   */
  async unlinkPOIFromTrip(segmentId: string, userId: string) {
    this.logger.log(`Desvinculando POI do segmento ${segmentId} - usuário ${userId}`);

    // Buscar segmento e verificar permissões
    const segment = await this.db.tripSegment.findUnique({
      where: { id: segmentId },
      include: { trip: true },
    });

    if (!segment) {
      throw new NotFoundException('Segmento não encontrado');
    }

    if (segment.trip.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para modificar esta viagem');
    }

    // Atualizar segmento removendo POI
    await this.db.tripSegment.update({
      where: { id: segmentId },
      data: {
        linkedPoiId: null,
        poiData: null,
      },
    });

    return { message: 'POI desvinculado com sucesso' };
  }

  /**
   * Infere o tipo de segmento baseado no tipo de POI
   */
  private inferSegmentTypeFromPOI(poiData: any): 'SLEEP' | 'SHOWER' | 'LAUNDRY' | 'REST' {
    const serviceType = poiData.serviceType;

    switch (serviceType) {
      case 'Pernoite':
        return 'SLEEP';
      case 'Banho':
        return 'SHOWER';
      case 'Lavar Roupa':
        return 'LAUNDRY';
      default:
        return 'REST';
    }
  }

  /**
   * Retorna duração padrão em minutos baseado no tipo de segmento
   */
  private getDefaultStopDuration(segmentType: string): number {
    switch (segmentType) {
      case 'SLEEP':
        return 480; // 8 horas
      case 'MEAL':
        return 60; // 1 hora
      case 'REST':
        return 30; // 30 minutos
      case 'SHOWER':
        return 30; // 30 minutos
      case 'LAUNDRY':
        return 90; // 1.5 horas
      case 'FUEL':
        return 15; // 15 minutos
      default:
        return 30;
    }
  }

  /**
   * Sugere POIs automaticamente para uma viagem planejada
   * @param userId ID do usuário
   * @param tripId ID da viagem
   * @returns Sugestões de POIs organizadas por prioridade
   */
  async suggestPOIsForTrip(userId: string, tripId: string): Promise<POISuggestionResponseDto> {
    this.logger.log(`Gerando sugestões de POIs para viagem ${tripId} - usuário ${userId}`);

    // Buscar viagem com segments
    const trip = await this.db.trip.findUnique({
      where: { id: tripId },
      include: { segments: { orderBy: { order: 'asc' } } },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para acessar esta viagem');
    }

    const segments = trip.segments ?? [];
    if (segments.length === 0) {
      throw new BadRequestException('Viagem não possui segmentos planejados');
    }

    // Extrair RoutePoints dos segments de direção
    const routePoints: RoutePoint[] = [];
    let accumulatedDistance = 0;

    for (const segment of segments) {
      if (segment.type === 'DRIVING' && segment.distance) {
        // Tentar extrair coordenadas do startLocation
        const coords = this.extractCoordinatesFromLocation(segment.startLocation);
        if (coords) {
          routePoints.push({
            lat: coords.lat,
            lng: coords.lng,
            cityName: segment.startLocation,
            distanceFromStart: accumulatedDistance,
          });
        }

        accumulatedDistance += segment.distance;

        // Adicionar endLocation se for diferente
        if (segment.endLocation && segment.endLocation !== segment.startLocation) {
          const endCoords = this.extractCoordinatesFromLocation(segment.endLocation);
          if (endCoords) {
            routePoints.push({
              lat: endCoords.lat,
              lng: endCoords.lng,
              cityName: segment.endLocation,
              distanceFromStart: accumulatedDistance,
            });
          }
        }
      }
    }

    if (routePoints.length === 0) {
      throw new BadRequestException('Não foi possível extrair pontos da rota');
    }

    const totalDistance = trip.totalDistance ?? accumulatedDistance;
    const maxDrivingHours = trip.maxDrivingHoursPerDay ?? 8;

    // Identificar pontos estratégicos
    const { dayEndPoints, intermediateStops } = this.identifyStrategicPoints(
      routePoints,
      totalDistance,
      maxDrivingHours,
    );

    // Buscar POIs para os pontos estratégicos
    const suggestions = await this.findPOIsForRoute(
      dayEndPoints,
      intermediateStops,
      trip.mealPreference ?? 'RESTAURANT',
      trip.sleepPreference ?? 'HOTEL',
    );

    // Contar sugestões por categoria
    const sleepSuggestions = suggestions.filter((s) => s.category === 'sleep').length;
    const mealSuggestions = suggestions.filter((s) => s.category === 'meal').length;
    const showerSuggestions = suggestions.filter((s) => s.category === 'shower').length;
    const laundrySuggestions = suggestions.filter((s) => s.category === 'laundry').length;
    const waterSuggestions = suggestions.filter((s) => s.category === 'water').length;

    this.logger.log(`Geradas ${suggestions.length} sugestões de POIs para viagem ${tripId}`);

    return {
      suggestions,
      totalSuggestions: suggestions.length,
      sleepSuggestions,
      mealSuggestions,
      showerSuggestions,
      laundrySuggestions,
      waterSuggestions,
    };
  }

  /**
   * Extrai coordenadas de uma string de localização
   * Suporta formatos: "lat,lng" ou nome de cidade
   */
  private extractCoordinatesFromLocation(location: string): { lat: number; lng: number } | null {
    // Tentar extrair coordenadas do formato "lat,lng"
    const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
      };
    }

    // Se não for coordenada, não temos como obter lat/lng sem geocoding
    // Por enquanto retorna null, mas poderia integrar com GeocodingProvider
    return null;
  }
}
