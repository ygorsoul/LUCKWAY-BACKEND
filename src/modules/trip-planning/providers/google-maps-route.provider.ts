import { Injectable, Logger } from '@nestjs/common';
import {
  RouteProvider,
  RouteEstimateInput,
  RouteEstimateOutput,
} from '../interfaces/route-provider.interface';

@Injectable()
export class GoogleMapsRouteProvider implements RouteProvider {
  private readonly logger = new Logger(GoogleMapsRouteProvider.name);
  private readonly apiKey = process.env.GOOGLE_API_KEY;

  async estimateRoute(input: RouteEstimateInput): Promise<RouteEstimateOutput> {
    if (!this.apiKey) {
      this.logger.warn('No GOOGLE_API_KEY configured, using mock estimates');
      return this.mockEstimate(input);
    }

    try {
      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
          },
          body: JSON.stringify({
            origin: { address: input.origin },
            destination: { address: input.destination },
            travelMode: 'DRIVE',
            units: 'METRIC',
          }),
        },
      );

      const data = await response.json();

      if (data.routes?.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distanceMeters ?? 0) / 1000;
        // duration comes as "123s" string
        const durationS = parseInt((route.duration ?? '0').replace('s', ''), 10);

        this.logger.log(
          `Route ${input.origin} → ${input.destination}: ${distanceKm.toFixed(0)} km`,
        );

        return {
          distanceKm,
          durationMinutes: Math.round(durationS / 60),
        };
      }

      this.logger.warn(`Routes API returned no routes. Response: ${JSON.stringify(data)}`);
    } catch (e) {
      this.logger.error('Routes API request failed', e);
    }

    this.logger.warn('Falling back to mock route estimate');
    return this.mockEstimate(input);
  }

  private mockEstimate(input: RouteEstimateInput): RouteEstimateOutput {
    const hash = this.hashString(input.origin + input.destination);
    const distanceKm = 50 + (hash % 1450);
    return { distanceKm, durationMinutes: Math.round((distanceKm / 80) * 60) };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
