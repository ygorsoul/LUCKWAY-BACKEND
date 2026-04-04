export interface RouteEstimateInput {
  origin: string;
  destination: string;
}

export interface RouteEstimateOutput {
  distanceKm: number;
  durationMinutes: number;
  polyline?: string;
}

export abstract class RouteProvider {
  abstract estimateRoute(input: RouteEstimateInput): Promise<RouteEstimateOutput>;
}
