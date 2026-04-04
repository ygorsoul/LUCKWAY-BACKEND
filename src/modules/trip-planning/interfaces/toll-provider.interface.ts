export interface TollEstimateInput {
  origin: string;
  destination: string;
  distanceKm: number;
  vehicleType: string;
}

export interface TollEstimateOutput {
  totalCost: number;
  tollCount: number;
  details?: Array<{
    name: string;
    cost: number;
  }>;
}

export abstract class TollProvider {
  abstract estimateTolls(input: TollEstimateInput): Promise<TollEstimateOutput>;
}
