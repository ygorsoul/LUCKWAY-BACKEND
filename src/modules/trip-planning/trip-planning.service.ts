import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { RouteProvider } from './interfaces/route-provider.interface';
import { TollProvider } from './interfaces/toll-provider.interface';
import { PlanTripDto } from './dto';
import { TripPlanningResult, TripSegment } from './types/planning.types';

interface StopEvent {
  atDrivingMinute: number;
  type: 'REST' | 'MEAL' | 'FUEL' | 'SLEEP' | 'SIGHTSEEING';
  stopDuration: number;
  stopNote: string;
  locationName: string;
  isWaypoint?: boolean;
}

interface BuildSegmentsConfig {
  origin: string;
  destination: string;
  waypoints: string[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  maxDrivingMinutesPerDay: number;
  breakfastEnabled: boolean;
  lunchEnabled: boolean;
  afternoonSnackEnabled: boolean;
  dinnerEnabled: boolean;
  bathroomBreaksEnabled: boolean;
  stretchBreaksEnabled: boolean;
  fuelStopsCount: number;
  fuelCost: number;
  tollCost: number;
}

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
    // Use per-country weighted average if provided, otherwise fall back to single fuelPrice
    let fuelPrice: number;
    if (dto.fuelPriceByCountry && Object.keys(dto.fuelPriceByCountry).length > 0) {
      const prices = Object.values(dto.fuelPriceByCountry).filter((p) => p > 0);
      fuelPrice = prices.length > 0
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : (dto.fuelPrice || 5.5);
    } else {
      fuelPrice = dto.fuelPrice || 5.5;
    }
    const fuelNeeded = route.distanceKm / vehicle.averageConsumption;
    const fuelCost = fuelNeeded * fuelPrice;

    // Calculate autonomy (how far can go with full tank)
    const autonomyKm = vehicle.tankCapacity * vehicle.averageConsumption;

    // Calculate fuel stops needed
    const fuelStopsCount = Math.floor(route.distanceKm / autonomyKm);

    // Configuration
    const maxDrivingHoursPerDay = dto.maxDrivingHoursPerDay || 8;
    const maxDrivingMinutesPerDay = maxDrivingHoursPerDay * 60;

    // Resolve meal/stop settings (individual fields override legacy mealBreakEnabled)
    const mealBreakEnabled = dto.mealBreakEnabled !== false;
    const lunchEnabled = dto.lunchEnabled ?? mealBreakEnabled;
    const breakfastEnabled = dto.breakfastEnabled ?? false;
    const afternoonSnackEnabled = dto.afternoonSnackEnabled ?? false;
    const dinnerEnabled = dto.dinnerEnabled ?? false;
    const bathroomBreaksEnabled = dto.bathroomBreaksEnabled ?? false;
    const stretchBreaksEnabled = dto.stretchBreaksEnabled ?? false;

    // Build segments
    const segments = this.buildSegments({
      origin: dto.origin,
      destination: dto.destination,
      waypoints: dto.waypoints || [],
      totalDistanceKm: route.distanceKm,
      totalDurationMinutes: route.durationMinutes,
      maxDrivingMinutesPerDay,
      breakfastEnabled,
      lunchEnabled,
      afternoonSnackEnabled,
      dinnerEnabled,
      bathroomBreaksEnabled,
      stretchBreaksEnabled,
      fuelStopsCount,
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

  private buildSegments(config: BuildSegmentsConfig): TripSegment[] {
    const segments: TripSegment[] = [];
    let order = 1;

    const {
      origin,
      destination,
      waypoints,
      totalDistanceKm,
      totalDurationMinutes,
      maxDrivingMinutesPerDay,
      breakfastEnabled,
      lunchEnabled,
      afternoonSnackEnabled,
      dinnerEnabled,
      bathroomBreaksEnabled,
      stretchBreaksEnabled,
      fuelStopsCount,
      fuelCost,
      tollCost,
    } = config;

    const stopEvents: StopEvent[] = [];

    // Helper: is a given minute within 'threshold' minutes of any existing event?
    const isNearEvent = (minute: number, threshold: number): boolean =>
      stopEvents.some((e) => Math.abs(e.atDrivingMinute - minute) < threshold);

    // 1. Multi-day sleep boundaries (highest priority)
    const numberOfDays = Math.ceil(totalDurationMinutes / maxDrivingMinutesPerDay);

    for (let day = 1; day < numberOfDays; day++) {
      const sleepAt = day * maxDrivingMinutesPerDay;

      // Dinner just before sleep (same driving position, stops appear in order)
      if (dinnerEnabled) {
        stopEvents.push({
          atDrivingMinute: sleepAt - 0.3,
          type: 'MEAL',
          stopDuration: 60,
          stopNote: 'Parada para jantar',
          locationName: `Jantar - Dia ${day}`,
        });
      }

      stopEvents.push({
        atDrivingMinute: sleepAt,
        type: 'SLEEP',
        stopDuration: 480,
        stopNote: 'Pernoite',
        locationName: `Pernoite - Dia ${day}`,
      });

      // Breakfast just after sleep
      if (breakfastEnabled) {
        stopEvents.push({
          atDrivingMinute: sleepAt + 0.3,
          type: 'MEAL',
          stopDuration: 30,
          stopNote: 'Parada para café da manhã',
          locationName: `Café da manhã - Dia ${day + 1}`,
        });
      }
    }

    // 2. Mandatory waypoints (proportionally distributed along route)
    waypoints.forEach((wp, i) => {
      const fraction = (i + 1) / (waypoints.length + 1);
      stopEvents.push({
        atDrivingMinute: fraction * totalDurationMinutes,
        type: 'SIGHTSEEING',
        stopDuration: 30,
        stopNote: `Parada em ${wp}`,
        locationName: wp,
        isWaypoint: true,
      });
    });

    // 3. Meal stops: lunch and afternoon snack
    if (lunchEnabled && totalDurationMinutes > 240) {
      const lunchAt = totalDurationMinutes / 2;
      if (!isNearEvent(lunchAt, 70)) {
        stopEvents.push({
          atDrivingMinute: lunchAt,
          type: 'MEAL',
          stopDuration: 60,
          stopNote: 'Parada para almoço',
          locationName: 'Almoço',
        });
      }
    }

    if (afternoonSnackEnabled && totalDurationMinutes > 360) {
      const snackAt = totalDurationMinutes * 0.75;
      if (!isNearEvent(snackAt, 50)) {
        stopEvents.push({
          atDrivingMinute: snackAt,
          type: 'MEAL',
          stopDuration: 20,
          stopNote: 'Parada para café da tarde',
          locationName: 'Café da tarde',
        });
      }
    }

    // 4. Bathroom / stretch stops every 2 hours of driving
    const restBreakEnabled = bathroomBreaksEnabled || stretchBreaksEnabled;
    if (restBreakEnabled) {
      const restNote =
        bathroomBreaksEnabled && stretchBreaksEnabled
          ? 'Parada para banheiro e alongamento'
          : bathroomBreaksEnabled
            ? 'Parada para banheiro'
            : 'Parada para alongamento';

      let restAt = 120; // first stop after 2h driving
      while (restAt < totalDurationMinutes - 30) {
        if (!isNearEvent(restAt, 40)) {
          stopEvents.push({
            atDrivingMinute: restAt,
            type: 'REST',
            stopDuration: 15,
            stopNote: restNote,
            locationName: 'Parada de descanso',
          });
        }
        restAt += 120;
      }
    }

    // 5. Fuel stops (distributed proportionally, skip if near another stop)
    if (fuelStopsCount > 0) {
      for (let i = 1; i <= fuelStopsCount; i++) {
        const fuelAt = (i / (fuelStopsCount + 1)) * totalDurationMinutes;
        if (!isNearEvent(fuelAt, 20)) {
          stopEvents.push({
            atDrivingMinute: fuelAt,
            type: 'FUEL',
            stopDuration: 15,
            stopNote: 'Parada para abastecimento',
            locationName: `Posto de combustível ${i}`,
          });
        }
      }
    }

    // Sort all events by driving minute
    stopEvents.sort((a, b) => a.atDrivingMinute - b.atDrivingMinute);

    // Build alternating DRIVING → STOP segments
    let prevDrivingMinute = 0;
    let prevLocation = origin;

    for (const event of stopEvents) {
      const drivingDuration = event.atDrivingMinute - prevDrivingMinute;

      // Add driving segment only if meaningful (> 1 min)
      if (drivingDuration > 1) {
        const fraction = drivingDuration / totalDurationMinutes;
        const toLocation = event.isWaypoint ? event.locationName : 'Parada intermediária';
        segments.push({
          order: order++,
          type: 'DRIVING',
          startLocation: prevLocation,
          endLocation: toLocation,
          distance: totalDistanceKm * fraction,
          estimatedTime: Math.round(drivingDuration),
          fuelCost: fuelCost * fraction,
          tollCost: tollCost * fraction,
        });
        prevLocation = event.isWaypoint ? event.locationName : 'Em rota';
      }

      prevDrivingMinute = event.atDrivingMinute;

      // Add the stop segment
      segments.push({
        order: order++,
        type: event.type,
        startLocation: event.locationName,
        stopDuration: event.stopDuration,
        stopNote: event.stopNote,
      });
    }

    // Final driving segment to destination
    const remainingDuration = totalDurationMinutes - prevDrivingMinute;
    if (remainingDuration > 1) {
      const fraction = remainingDuration / totalDurationMinutes;
      segments.push({
        order: order++,
        type: 'DRIVING',
        startLocation: prevLocation,
        endLocation: destination,
        distance: totalDistanceKm * fraction,
        estimatedTime: Math.round(remainingDuration),
        fuelCost: fuelCost * fraction,
        tollCost: tollCost * fraction,
      });
    }

    return segments;
  }

  private calculateSummary(segments: TripSegment[], totalDistanceKm: number) {
    const drivingSegments = segments.filter((s) => s.type === 'DRIVING');
    const restStops = segments.filter((s) => s.type === 'REST').length;
    const mealStops = segments.filter((s) => s.type === 'MEAL').length;
    const sleepStops = segments.filter((s) => s.type === 'SLEEP').length;
    const waypointStops = segments.filter((s) => s.type === 'SIGHTSEEING').length;

    const drivingDays = sleepStops + 1;
    const averageKmPerDay = totalDistanceKm / drivingDays;

    return {
      drivingDays,
      totalRestStops: restStops,
      totalMealStops: mealStops,
      totalSleepStops: sleepStops,
      totalWaypointStops: waypointStops,
      averageKmPerDay,
    };
  }
}
