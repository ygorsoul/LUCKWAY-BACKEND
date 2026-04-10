import { Injectable, Logger } from '@nestjs/common';
import { POIsService } from './pois.service';
import { POI, POIServiceType } from './types/poi.types';

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

  constructor(private readonly poisService: POIsService) {}

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
}
