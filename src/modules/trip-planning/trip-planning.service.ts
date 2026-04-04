import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { RouteProvider } from './interfaces/route-provider.interface';
import { TollProvider } from './interfaces/toll-provider.interface';
import { PlanTripDto } from './dto';
import { TripPlanningResult, TripSegment } from './types/planning.types';

@Injectable()
export class TripPlanningService {
  constructor(
    private db: DatabaseService,
    private routeProvider: RouteProvider,
    private tollProvider: TollProvider,
  ) {}

  async planTrip(userId: string, dto: PlanTripDto): Promise<TripPlanningResult> {
    // Get vehicle
    const vehicle = await this.db.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.userId !== userId) {
      throw new ForbiddenException('You do not have access to this vehicle');
    }

    // Get route estimate
    const route = await this.routeProvider.estimateRoute({
      origin: dto.origin,
      destination: dto.destination,
    });

    // Get toll estimate
    const tolls = await this.tollProvider.estimateTolls({
      origin: dto.origin,
      destination: dto.destination,
      distanceKm: route.distanceKm,
      vehicleType: vehicle.type,
    });

    // Calculate fuel consumption
    const fuelPrice = dto.fuelPrice || 5.5; // Default R$ 5.50 per liter
    const fuelNeeded = route.distanceKm / vehicle.averageConsumption;
    const fuelCost = fuelNeeded * fuelPrice;

    // Calculate autonomy (how far can go with full tank)
    const autonomyKm = vehicle.tankCapacity * vehicle.averageConsumption;

    // Calculate fuel stops needed
    const fuelStopsCount = Math.floor(route.distanceKm / autonomyKm);

    // Configuration
    const maxDrivingHoursPerDay = dto.maxDrivingHoursPerDay || 8;
    const mealBreakEnabled = dto.mealBreakEnabled !== false;
    const maxDrivingMinutesPerDay = maxDrivingHoursPerDay * 60;

    // Build segments
    const segments = this.buildSegments({
      origin: dto.origin,
      destination: dto.destination,
      totalDistanceKm: route.distanceKm,
      totalDurationMinutes: route.durationMinutes,
      maxDrivingMinutesPerDay,
      mealBreakEnabled,
      fuelStopsCount,
      autonomyKm,
      fuelCost,
      tollCost: tolls.totalCost,
    });

    // Calculate summary
    const summary = this.calculateSummary(segments, route.distanceKm);

    const totalCost = fuelCost + tolls.totalCost;

    return {
      totalDistanceKm: route.distanceKm,
      totalDurationMinutes: route.durationMinutes,
      estimatedFuelCost: fuelCost,
      estimatedTollCost: tolls.totalCost,
      totalEstimatedCost: totalCost,
      autonomyKm,
      fuelStopsCount,
      segments,
      summary,
    };
  }

  private buildSegments(config: {
    origin: string;
    destination: string;
    totalDistanceKm: number;
    totalDurationMinutes: number;
    maxDrivingMinutesPerDay: number;
    mealBreakEnabled: boolean;
    fuelStopsCount: number;
    autonomyKm: number;
    fuelCost: number;
    tollCost: number;
  }): TripSegment[] {
    const segments: TripSegment[] = [];
    let order = 1;

    // Check if trip can be done in one day
    if (config.totalDurationMinutes <= config.maxDrivingMinutesPerDay) {
      // Single day trip
      segments.push({
        order: order++,
        type: 'DRIVING',
        startLocation: config.origin,
        endLocation: config.destination,
        distance: config.totalDistanceKm,
        estimatedTime: config.totalDurationMinutes,
        fuelCost: config.fuelCost,
        tollCost: config.tollCost,
      });

      // Add meal break if enabled and trip is long enough (> 4 hours)
      if (config.mealBreakEnabled && config.totalDurationMinutes > 240) {
        segments.push({
          order: order++,
          type: 'MEAL',
          startLocation: 'Parada intermediária',
          stopDuration: 60,
          stopNote: 'Parada para refeição',
        });
      }
    } else {
      // Multi-day trip - split into segments
      const numberOfDays = Math.ceil(config.totalDurationMinutes / config.maxDrivingMinutesPerDay);
      const kmPerDay = config.totalDistanceKm / numberOfDays;
      const minutesPerDay = config.totalDurationMinutes / numberOfDays;
      const fuelCostPerDay = config.fuelCost / numberOfDays;
      const tollCostPerDay = config.tollCost / numberOfDays;

      for (let day = 0; day < numberOfDays; day++) {
        const isFirstDay = day === 0;
        const isLastDay = day === numberOfDays - 1;

        // Driving segment for the day
        segments.push({
          order: order++,
          type: 'DRIVING',
          startLocation: isFirstDay ? config.origin : `Trecho ${day + 1}`,
          endLocation: isLastDay ? config.destination : `Fim do dia ${day + 1}`,
          distance: kmPerDay,
          estimatedTime: minutesPerDay,
          fuelCost: fuelCostPerDay,
          tollCost: tollCostPerDay,
        });

        // Meal break
        if (config.mealBreakEnabled) {
          segments.push({
            order: order++,
            type: 'MEAL',
            startLocation: `Parada - Dia ${day + 1}`,
            stopDuration: 60,
            stopNote: 'Parada para almoço',
          });
        }

        // Sleep stop (except on last day)
        if (!isLastDay) {
          segments.push({
            order: order++,
            type: 'SLEEP',
            startLocation: `Pernoite - Dia ${day + 1}`,
            stopDuration: 480, // 8 hours
            stopNote: 'Parada para pernoite',
          });
        }
      }
    }

    // Add fuel stops if needed
    if (config.fuelStopsCount > 0) {
      for (let i = 0; i < config.fuelStopsCount; i++) {
        segments.push({
          order: order++,
          type: 'FUEL',
          startLocation: `Posto de combustível ${i + 1}`,
          stopDuration: 15,
          stopNote: 'Parada para abastecimento',
        });
      }
    }

    return segments.sort((a, b) => a.order - b.order);
  }

  private calculateSummary(segments: TripSegment[], totalDistanceKm: number) {
    const drivingSegments = segments.filter((s) => s.type === 'DRIVING');
    const restStops = segments.filter((s) => s.type === 'REST').length;
    const mealStops = segments.filter((s) => s.type === 'MEAL').length;
    const sleepStops = segments.filter((s) => s.type === 'SLEEP').length;

    const drivingDays = sleepStops + 1;
    const averageKmPerDay = totalDistanceKm / drivingDays;

    return {
      drivingDays,
      totalRestStops: restStops,
      totalMealStops: mealStops,
      totalSleepStops: sleepStops,
      averageKmPerDay,
    };
  }
}
