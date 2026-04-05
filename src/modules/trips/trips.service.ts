import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { TripPlanningService } from '../trip-planning/trip-planning.service';
import { CreateTripDto, UpdateTripDto } from './dto';

@Injectable()
export class TripsService {
  constructor(
    private db: DatabaseService,
    private tripPlanningService: TripPlanningService,
  ) {}

  async create(userId: string, dto: CreateTripDto) {
    // Plan the trip
    const planning = await this.tripPlanningService.planTrip(userId, {
      origin: dto.origin,
      destination: dto.destination,
      vehicleId: dto.vehicleId,
      maxDrivingHoursPerDay: dto.maxDrivingHoursPerDay,
      departurePreferredTime: dto.departurePreferredTime,
      drivingEndLimitTime: dto.drivingEndLimitTime,
      mealBreakEnabled: dto.mealBreakEnabled,
      travelersCount: dto.travelersCount,
      fuelPrice: dto.fuelPrice,
      departureDate: dto.startDate,
    });

    // Create trip with planning results
    const trip = await this.db.trip.create({
      data: {
        userId,
        vehicleId: dto.vehicleId,
        name: dto.name,
        status: dto.status || 'DRAFT',
        origin: dto.origin,
        destination: dto.destination,
        maxDrivingHoursPerDay: dto.maxDrivingHoursPerDay,
        departurePreferredTime: dto.departurePreferredTime,
        drivingEndLimitTime: dto.drivingEndLimitTime,
        mealBreakEnabled: dto.mealBreakEnabled ?? true,
        travelersCount: dto.travelersCount ?? 1,
        fuelPrice: dto.fuelPrice,
        totalDistance: planning.totalDistanceKm,
        estimatedDuration: Math.round(planning.totalDurationMinutes),
        estimatedFuelCost: planning.estimatedFuelCost,
        estimatedTollCost: planning.estimatedTollCost,
        totalEstimatedCost: planning.totalEstimatedCost,
        rawPlanningJson: JSON.stringify(planning),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        segments: {
          create: planning.segments.map((segment) => ({
            order: segment.order,
            type: segment.type,
            startLocation: segment.startLocation,
            endLocation: segment.endLocation,
            distance: segment.distance,
            estimatedTime: segment.estimatedTime != null ? Math.round(segment.estimatedTime) : null,
            fuelCost: segment.fuelCost,
            tollCost: segment.tollCost,
            stopDuration: segment.stopDuration != null ? Math.round(segment.stopDuration) : null,
            stopNote: segment.stopNote,
            startTime: segment.startTime ? new Date(segment.startTime) : null,
            endTime: segment.endTime ? new Date(segment.endTime) : null,
          })),
        },
      },
      include: {
        vehicle: true,
        segments: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return trip;
  }

  async findAll(userId: string) {
    return this.db.trip.findMany({
      where: { userId },
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
            type: true,
            brand: true,
            model: true,
          },
        },
        _count: {
          select: {
            segments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const trip = await this.db.trip.findUnique({
      where: { id },
      include: {
        vehicle: true,
        segments: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.userId !== userId) {
      throw new ForbiddenException('You do not have access to this trip');
    }

    return trip;
  }

  async update(userId: string, id: string, dto: UpdateTripDto) {
    // Verify ownership
    await this.findOne(userId, id);

    const trip = await this.db.trip.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        vehicle: true,
        segments: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return trip;
  }

  async remove(userId: string, id: string) {
    // Verify ownership
    await this.findOne(userId, id);

    await this.db.trip.delete({
      where: { id },
    });

    return { message: 'Trip deleted successfully' };
  }
}

