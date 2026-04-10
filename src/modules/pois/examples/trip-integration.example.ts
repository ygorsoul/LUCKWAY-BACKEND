/**
 * EXEMPLO DE INTEGRAÇÃO DO MÓDULO POIs COM TRIP PLANNING
 *
 * Este arquivo mostra como integrar a busca de infraestrutura de apoio
 * ao sistema de planejamento de rotas.
 */

import { Injectable } from '@nestjs/common';
import { POIsService } from '../pois.service';
import { POI } from '../types/poi.types';

/**
 * ESTRATÉGIA 1: Buscar POIs apenas no destino final
 *
 * Caso de uso: Usuário quer saber qual infraestrutura está disponível
 * na região de chegada para decidir onde pernoitar/banhar/etc.
 */
@Injectable()
export class TripWithDestinationPOIs {
  constructor(private readonly poisService: POIsService) {}

  async planTripWithDestinationInfrastructure(
    destinationLat: number,
    destinationLng: number,
  ) {
    // Buscar infraestrutura na região de chegada (raio de 10km)
    const poisAtDestination = await this.poisService.searchPOIsAtDestination(
      destinationLat,
      destinationLng,
      10000, // 10km
    );

    // Agrupar por tipo de serviço
    const grouped = this.groupPOIsByServiceType(poisAtDestination);

    return {
      destination: { lat: destinationLat, lng: destinationLng },
      infrastructure: {
        pernoite: grouped.Pernoite || [],
        banho: grouped.Banho || [],
        lavanderia: grouped['Lavar Roupa'] || [],
        agua: grouped.Abastecimento || [],
      },
    };
  }

  private groupPOIsByServiceType(pois: POI[]) {
    return pois.reduce(
      (acc, poi) => {
        if (!acc[poi.serviceType]) {
          acc[poi.serviceType] = [];
        }
        acc[poi.serviceType].push(poi);
        return acc;
      },
      {} as Record<string, POI[]>,
    );
  }
}

/**
 * ESTRATÉGIA 2: Buscar POIs em pontos de parada estratégicos
 *
 * Caso de uso: Para viagens longas, buscar infraestrutura a cada X km
 * ou no final de cada dia de viagem.
 */
@Injectable()
export class TripWithStopPointPOIs {
  constructor(private readonly poisService: POIsService) {}

  /**
   * Identifica pontos de parada ao longo da rota e busca POIs em cada um
   *
   * @param routeCoordinates Array de coordenadas da rota completa
   * @param intervalKm Intervalo em km para criar pontos de parada (ex: 200km)
   * @param totalDistanceKm Distância total da rota
   */
  async findPOIsAlongRoute(
    routeCoordinates: Array<{ lat: number; lng: number }>,
    intervalKm: number,
    totalDistanceKm: number,
  ) {
    // Calcular quantos pontos de parada serão necessários
    const numberOfStops = Math.floor(totalDistanceKm / intervalKm);

    // Calcular índices dos pontos de parada no array de coordenadas
    const stopIndices = this.calculateStopIndices(
      routeCoordinates.length,
      numberOfStops,
    );

    // Buscar POIs em cada ponto de parada em paralelo
    const poisByStop = await Promise.all(
      stopIndices.map(async (index) => {
        const point = routeCoordinates[index];
        const pois = await this.poisService.searchPOIs({
          lat: point.lat,
          lng: point.lng,
          radiusInMeters: 5000, // 5km de raio em cada parada
        });

        return {
          stopNumber: index,
          coordinates: point,
          pois,
        };
      }),
    );

    return poisByStop;
  }

  private calculateStopIndices(totalPoints: number, numberOfStops: number) {
    const indices: number[] = [];
    const step = Math.floor(totalPoints / (numberOfStops + 1));

    for (let i = 1; i <= numberOfStops; i++) {
      indices.push(i * step);
    }

    return indices;
  }
}

/**
 * ESTRATÉGIA 3: Buscar POIs nos pontos de pernoite planejados
 *
 * Caso de uso: O sistema já planejou onde o usuário vai dormir (viagens multi-dia).
 * Agora queremos encontrar camping/estacionamento/infraestrutura nessas cidades.
 */
@Injectable()
export class TripWithSleepStopPOIs {
  constructor(private readonly poisService: POIsService) {}

  /**
   * Para cada cidade onde o usuário vai pernoitar, busca infraestrutura disponível
   *
   * @param sleepCities Array de cidades intermediárias onde haverá pernoite
   */
  async findInfrastructureAtSleepStops(
    sleepCities: Array<{ name: string; lat: number; lng: number }>,
  ) {
    const infrastructureByCity = await Promise.all(
      sleepCities.map(async (city) => {
        // Buscar infraestrutura num raio maior (15km) pois cidades podem ser grandes
        const pois = await this.poisService.searchPOIs({
          lat: city.lat,
          lng: city.lng,
          radiusInMeters: 15000, // 15km
        });

        // Filtrar apenas POIs relevantes para pernoite
        const sleepRelatedPOIs = pois.filter(
          (poi) =>
            poi.serviceType === 'Pernoite' ||
            poi.serviceType === 'Banho' ||
            poi.serviceType === 'Lavar Roupa',
        );

        return {
          city: city.name,
          coordinates: { lat: city.lat, lng: city.lng },
          infrastructure: sleepRelatedPOIs,
        };
      }),
    );

    return infrastructureByCity;
  }
}

/**
 * EXEMPLO DE USO NO TRIP PLANNING SERVICE
 *
 * Como modificar o TripPlanningService para incluir POIs:
 */

// 1. Adicionar POIsModule aos imports do TripPlanningModule
/*
@Module({
  imports: [POIsModule], // <-- Adicionar
  controllers: [TripPlanningController],
  providers: [TripPlanningService, ...],
})
export class TripPlanningModule {}
*/

// 2. Injetar o POIsService no TripPlanningService
/*
@Injectable()
export class TripPlanningService {
  constructor(
    private db: DatabaseService,
    private routeProvider: RouteProvider,
    private tollProvider: TollProvider,
    private poisService: POIsService, // <-- Adicionar
  ) {}

  async planTrip(userId: string, dto: PlanTripDto): Promise<TripPlanningResult> {
    // ... lógica existente de planejamento

    // Após calcular a rota, buscar POIs no destino
    const destinationCoords = this.extractDestinationCoordinates(route);
    const poisAtDestination = await this.poisService.searchPOIsAtDestination(
      destinationCoords.lat,
      destinationCoords.lng,
    );

    return {
      ...result, // resultado existente
      poisAtDestination, // adicionar POIs ao resultado
    };
  }
}
*/

/**
 * EXEMPLO DE RESPOSTA COM POIs INTEGRADOS
 */
interface TripPlanningResultWithPOIs {
  // Campos existentes do TripPlanningResult
  totalDistanceKm: number;
  totalDurationMinutes: number;
  estimatedFuelCost: number;
  estimatedTollCost: number;
  segments: any[];

  // Novos campos com POIs
  poisAtDestination?: POI[];
  poisByStopPoint?: Array<{
    stopNumber: number;
    coordinates: { lat: number; lng: number };
    pois: POI[];
  }>;
  poisBySleepCity?: Array<{
    city: string;
    coordinates: { lat: number; lng: number };
    infrastructure: POI[];
  }>;
}

/**
 * EXEMPLO DE REQUEST DO FRONTEND
 */
/*
// O frontend pode fazer uma requisição separada para buscar POIs
// após receber o resultado do planejamento da viagem:

// 1. Planejar viagem
const tripResult = await fetch('/trip-planning/plan', {
  method: 'POST',
  body: JSON.stringify(tripData)
});

// 2. Extrair coordenadas do destino do resultado
const destination = tripResult.segments[tripResult.segments.length - 1].endLocation;

// 3. Buscar POIs no destino
const pois = await fetch('/pois/search-at-destination', {
  method: 'POST',
  body: JSON.stringify({
    lat: destination.lat,
    lng: destination.lng,
    radiusInMeters: 10000
  })
});
*/
