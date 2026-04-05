export interface TripSegment {
  order: number;
  type: 'DRIVING' | 'REST' | 'MEAL' | 'FUEL' | 'SLEEP' | 'SIGHTSEEING';
  startLocation: string;
  endLocation?: string;
  distance?: number;
  estimatedTime?: number;
  fuelCost?: number;
  tollCost?: number;
  stopDuration?: number;
  stopNote?: string;
  startTime?: string;
  endTime?: string;
}

export interface TripPlanningResult {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  estimatedFuelCost: number;
  estimatedTollCost: number;
  totalEstimatedCost: number;
  autonomyKm: number;
  fuelStopsCount: number;
  segments: TripSegment[];
  summary: {
    drivingDays: number;
    totalRestStops: number;
    totalMealStops: number;
    totalSleepStops: number;
    averageKmPerDay: number;
  };
}
