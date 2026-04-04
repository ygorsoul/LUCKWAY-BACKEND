import { Injectable } from '@nestjs/common';
import {
  RouteProvider,
  RouteEstimateInput,
  RouteEstimateOutput,
} from '../interfaces/route-provider.interface';

@Injectable()
export class MockRouteProvider implements RouteProvider {
  async estimateRoute(input: RouteEstimateInput): Promise<RouteEstimateOutput> {
    // Simple heuristic: hash the strings to get consistent values
    const hash = this.hashString(input.origin + input.destination);

    // Generate a distance between 50km and 1500km
    const distanceKm = 50 + (hash % 1450);

    // Assume average speed of 80 km/h
    const durationMinutes = Math.round((distanceKm / 80) * 60);

    return {
      distanceKm,
      durationMinutes,
    };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
