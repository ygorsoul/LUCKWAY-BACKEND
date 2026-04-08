import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { TripPlanningService } from './trip-planning.service';
import { FuelPriceService } from './services/fuel-price.service';
import { PlanTripDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('trip-planning')
@UseGuards(JwtAuthGuard)
export class TripPlanningController {
  constructor(
    private readonly tripPlanningService: TripPlanningService,
    private readonly fuelPriceService: FuelPriceService,
  ) {}

  @Post('estimate')
  async estimate(@GetUser() user: any, @Body() dto: PlanTripDto) {
    return this.tripPlanningService.planTrip(user.id, dto);
  }

  @Post('build')
  async build(@GetUser() user: any, @Body() dto: PlanTripDto) {
    const planning = await this.tripPlanningService.planTrip(user.id, dto);
    return {
      planning,
      metadata: { generatedAt: new Date().toISOString(), version: '1.0.0' },
    };
  }

  @Get('detect-countries')
  async detectCountries(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('waypoints') waypointsRaw?: string,
  ) {
    const locations = [
      origin,
      ...(waypointsRaw ? waypointsRaw.split(',').map((w) => w.trim()).filter(Boolean) : []),
      destination,
    ].filter(Boolean);

    if (locations.length < 2) return [];
    return this.fuelPriceService.extractCountries(locations);
  }

  @Get('fuel-price')
  async suggestFuelPrice(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('waypoints') waypointsRaw?: string,
    @Query('fuelType') fuelType?: string,
  ) {
    const waypoints = waypointsRaw
      ? waypointsRaw.split(',').map((w) => w.trim()).filter(Boolean)
      : [];
    return this.fuelPriceService.suggestFuelPrices(origin, destination, waypoints, fuelType as any);
  }

  @Get('autocomplete')
  async autocomplete(@Query('input') input: string) {
    if (!input || input.trim().length < 2) return [];

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return [];

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: input.trim(), languageCode: 'pt-BR' }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return (data.suggestions || [])
        .map((s: any) => s?.placePrediction?.text?.text)
        .filter(Boolean)
        .slice(0, 6);
    } catch {
      return [];
    }
  }
}
