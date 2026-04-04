import { Injectable } from '@nestjs/common';
import {
  TollProvider,
  TollEstimateInput,
  TollEstimateOutput,
} from '../interfaces/toll-provider.interface';

@Injectable()
export class MockTollProvider implements TollProvider {
  async estimateTolls(input: TollEstimateInput): Promise<TollEstimateOutput> {
    // Estimate tolls based on distance
    // Assume 1 toll every 150km on average
    const tollCount = Math.floor(input.distanceKm / 150);

    // Average toll cost based on vehicle type
    const tollCostMap: Record<string, number> = {
      CAR: 8.5,
      VAN: 12.0,
      TRAILER: 15.0,
      MOTORHOME: 15.0,
    };

    const avgTollCost = tollCostMap[input.vehicleType] || 10.0;
    const totalCost = tollCount * avgTollCost;

    // Generate mock toll details
    const details = Array.from({ length: tollCount }, (_, i) => ({
      name: `Praça de Pedágio ${i + 1}`,
      cost: avgTollCost,
    }));

    return {
      totalCost,
      tollCount,
      details,
    };
  }
}
